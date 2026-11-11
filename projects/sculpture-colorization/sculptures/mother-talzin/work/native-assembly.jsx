// Native Photoshop assembly. ES3; invoked once per operation by the local MCP.
(function () {
    var cfg = ASSEMBLY_CONFIG, phase = 'start', oldDialogs = app.displayDialogs;
    var oldUnits = app.preferences.rulerUnits;
    function c(v) { return charIDToTypeID(v); }
    function s(v) { return stringIDToTypeID(v); }
    function ensure(v, message) { if (!v) throw Error(message); }
    function bounds(layer) { var b=layer.bounds;return [b[0].as('px'),b[1].as('px'),b[2].as('px'),b[3].as('px')]; }
    function documentById(id) { for(var i=0;i<app.documents.length;i++)if(app.documents[i].id===id)return app.documents[i];throw Error('Document ID missing: '+id); }
    function sourceDocument() {
        for(var i=0;i<app.documents.length;i++) {
            try { if(app.documents[i].fullName.fsName===File(cfg.source).fsName)return app.documents[i]; } catch(e){}
        }
        return app.open(File(cfg.source));
    }
    function place(path, name, group, rect) {
        var desc=new ActionDescriptor();desc.putPath(c('null'),File(path));
        desc.putEnumerated(c('FTcs'),c('QCSt'),c('Qcsa'));
        executeAction(c('Plc '),desc,DialogModes.NO);
        var l=app.activeDocument.activeLayer;l.name=name;
        var before=bounds(l), w=before[2]-before[0],h=before[3]-before[1];
        var scale=Math.max(rect.width/w,rect.height/h);
        l.resize(scale*100,scale*100,AnchorPosition.TOPLEFT);
        var after=bounds(l);
        l.translate(UnitValue(rect.x+(rect.width-(after[2]-after[0]))/2-after[0],'px'),UnitValue(rect.y+(rect.height-(after[3]-after[1]))/2-after[1],'px'));
        l.move(group,ElementPlacement.INSIDE);app.activeDocument.activeLayer=l;
        return {layer:l,scale:scale,originalBounds:before,bounds:bounds(l)};
    }
    function gradientChannel(doc, name, top, bottom) {
        var ch=doc.channels.add();ch.name=name;doc.activeChannels=[ch];
        var desc=new ActionDescriptor(),from=new ActionDescriptor(),to=new ActionDescriptor();
        from.putUnitDouble(c('Hrzn'),c('#Pxl'),1620);from.putUnitDouble(c('Vrtc'),c('#Pxl'),top);
        to.putUnitDouble(c('Hrzn'),c('#Pxl'),1620);to.putUnitDouble(c('Vrtc'),c('#Pxl'),bottom);
        desc.putObject(c('From'),c('Pnt '),from);desc.putObject(c('T   '),c('Pnt '),to);
        desc.putEnumerated(c('Type'),c('GrdT'),c('Lnr '));desc.putBoolean(c('Dthr'),false);desc.putBoolean(c('UsMs'),true);
        var g=new ActionDescriptor();g.putString(c('Nm  '),'Source overlap black to white');
        g.putEnumerated(c('GrdF'),c('GrdF'),c('CstS'));g.putDouble(c('Intr'),4096);
        var colors=new ActionList(),trans=new ActionList();
        for(var i=0;i<2;i++) {
            var stop=new ActionDescriptor(),rgb=new ActionDescriptor();
            rgb.putDouble(c('Rd  '),i*255);rgb.putDouble(c('Grn '),i*255);rgb.putDouble(c('Bl  '),i*255);
            stop.putObject(c('Clr '),c('RGBC'),rgb);stop.putEnumerated(c('Type'),c('Clry'),c('UsrS'));
            stop.putInteger(c('Lctn'),i*4096);stop.putInteger(c('Mdpn'),50);colors.putObject(c('Clrt'),stop);
            var t=new ActionDescriptor();t.putUnitDouble(c('Opct'),c('#Prc'),100);t.putInteger(c('Lctn'),i*4096);t.putInteger(c('Mdpn'),50);trans.putObject(c('TrnS'),t);
        }
        g.putList(c('Clrs'),colors);g.putList(c('Trns'),trans);desc.putObject(c('Grad'),c('Grdn'),g);
        executeAction(c('Grdn'),desc,DialogModes.NO);return ch;
    }
    function revealSelectionMask() {
        var desc=new ActionDescriptor(),ref=new ActionReference();desc.putClass(c('Nw  '),c('Chnl'));
        ref.putEnumerated(c('Chnl'),c('Chnl'),c('Msk '));desc.putReference(c('At  '),ref);
        desc.putEnumerated(c('Usng'),c('UsrM'),c('RvlS'));executeAction(c('Mk  '),desc,DialogModes.NO);
    }
    function layerAudit(l) {
        var o={name:l.name,id:l.id,type:l.typename,visible:l.visible};
        if(l.typename==='LayerSet') {o.children=[];for(var i=0;i<l.layers.length;i++)o.children.push(layerAudit(l.layers[i]));}
        else {o.kind=String(l.kind);var ref=new ActionReference();ref.putIdentifier(c('Lyr '),l.id);var d=executeActionGet(ref);o.userMask=d.hasKey(s('hasUserMask'))&&d.getBoolean(s('hasUserMask'));if(o.userMask)o.userMaskEnabled=d.getBoolean(s('userMaskEnabled'));}
        return o;
    }
    function audit(d) {
        var o={id:d.id,name:d.name,width:d.width.as('px'),height:d.height.as('px'),depth:String(d.bitsPerChannel),mode:String(d.mode),profile:null,layers:[],channels:[]};
        try{o.path=d.fullName.fsName;}catch(e){}try{o.profile=d.colorProfileName;}catch(e){}
        for(var i=0;i<d.layers.length;i++)o.layers.push(layerAudit(d.layers[i]));
        for(var j=0;j<d.channels.length;j++)o.channels.push(d.channels[j].name);return o;
    }
    function write(path,obj) {var f=File(path);ensure(f.open('w'),'Cannot write audit');f.encoding='UTF8';f.write(JSON.stringify(obj));f.close();}
    function png(d,path) {ensure(!File(path).exists,'Refusing PNG overwrite: '+path);var opt=new PNGSaveOptions();opt.compression=4;opt.interlaced=false;d.saveAs(File(path),opt,true,Extension.LOWERCASE);}
    try {
        app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
        if(cfg.operation==='assemble') {
            ensure(!File(cfg.editable).exists&&!File(cfg.pre).exists,'Version already exists; inspect state');
            phase='verify-source';var source=sourceDocument();app.activeDocument=source;
            ensure(source.width.as('px')===3240&&source.height.as('px')===4050,'Unexpected source dimensions');
            ensure(source.bitsPerChannel===BitsPerChannelType.EIGHT&&source.mode===DocumentMode.RGB,'Unexpected source depth/mode');
            var sourceInfo=audit(source);ensure(source.layers.length===1,'Expected flat source');
            phase='duplicate-source';var d=source.duplicate(cfg.name,false);app.activeDocument=d;
            var reference=d.layers[0];reference.name='SOURCE COMPOSITE - unchanged';
            var black=d.artLayers.add();black.name='BLACK BACKGROUND';d.selection.selectAll();var color=new SolidColor();color.rgb.red=0;color.rgb.green=0;color.rgb.blue=0;d.selection.fill(color);d.selection.deselect();reference.visible=false;
            phase='source-passes';var passes=d.layerSets.add();passes.name='SOURCE PASSES - original data';
            for(var k=0;k<cfg.passes.length;k++)place(cfg.passes[k].preview,cfg.passes[k].name+' - source data',passes,{x:0,y:0,width:3240,height:4050});
            passes.visible=false;
            phase='source-silhouette';var md=app.open(File(cfg.mask));
            var silhouette=md.channels[0].duplicate(d,ElementPlacement.PLACEATEND);md.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;silhouette.name='SOURCE SILHOUETTE - unchanged';d.activeChannels=d.componentChannels;
            var crops=d.layerSets.add();crops.name='COLORIZED CROPS - reviewed';var placements=[];
            for(var n=0;n<cfg.crops.length;n++) {
                phase='crop-'+cfg.crops[n].id;var cr=cfg.crops[n],r=cr.rect;
                var p=place(cr.path,cr.id+' - '+cr.version,crops,r),join=null;
                var joinStart=typeof cr.joinStart==='number'?cr.joinStart:r.y;
                if(n>0) {var prev=cfg.crops[n-1].rect;var end=Math.min(prev.y+prev.height,r.y+r.height);ensure(end>joinStart&&joinStart>=r.y,'Missing join overlap');join=gradientChannel(d,'JOIN '+cr.id+' - editable source overlap',joinStart,end);d.selection.load(join,SelectionType.REPLACE);d.selection.load(silhouette,SelectionType.INTERSECT);}
                else d.selection.load(silhouette,SelectionType.REPLACE);
                d.selection.select([[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]],SelectionType.INTERSECT,0,false);
                d.activeChannels=d.componentChannels;d.activeLayer=p.layer;revealSelectionMask();d.selection.deselect();d.activeChannels=d.componentChannels;
                placements.push({id:cr.id,layerId:p.layer.id,sourceRect:r,uniformScale:p.scale,placedBounds:p.bounds,joinTop:n>0?joinStart:null,joinBottom:n>0?end:null});
            }
            phase='pre-save-render';d.activeChannels=d.componentChannels;png(d,cfg.pre);
            var assembled={success:true,stage:'assembled-preview',view:cfg.view,source:sourceInfo,sourceId:source.id,workId:d.id,placements:placements,document:audit(d)};
            write(cfg.audit,assembled);return JSON.stringify(assembled);
        }
        if(cfg.operation==='save-reopen') {
            phase='target-work-document';var work=documentById(cfg.workId);app.activeDocument=work;
            ensure(work.name===cfg.name,'Work document name mismatch');ensure(!File(cfg.editable).exists,'Refusing editable overwrite');
            phase='save-layered';var options=new PhotoshopSaveOptions();options.layers=true;options.alphaChannels=true;options.embedColorProfile=true;
            work.saveAs(File(cfg.editable),options,false,Extension.LOWERCASE);
            phase='close-and-reopen';work.close(SaveOptions.DONOTSAVECHANGES);var reopened=app.open(File(cfg.editable));
            ensure(reopened.fullName.fsName===File(cfg.editable).fsName,'Reopen path mismatch');
            phase='reopened-render';reopened.activeChannels=reopened.componentChannels;png(reopened,cfg.post);
            var result={success:true,stage:'disk-reopened',view:cfg.view,document:audit(reopened)};write(cfg.reopenAudit,result);return JSON.stringify(result);
        }
        if(cfg.operation==='delivery-export') {
            var doc=null,alreadyOpen=false;
            for(var di=0;di<app.documents.length;di++){try{if(app.documents[di].fullName.fsName===File(cfg.editable).fsName){doc=app.documents[di];alreadyOpen=true;break;}}catch(e){}}
            if(!doc)doc=app.open(File(cfg.editable));app.activeDocument=doc;ensure(!File(cfg.delivery).exists,'Delivery export exists');
            var ex=new ExportOptionsSaveForWeb();ex.format=SaveDocumentType.PNG;ex.PNG8=false;ex.transparency=false;ex.interlaced=false;ex.includeProfile=true;ex.optimized=false;
            doc.exportDocument(File(cfg.delivery),ExportType.SAVEFORWEB,ex);
            var info={success:true,stage:'native-profiled-delivery-export',view:cfg.view,sourceProfile:doc.colorProfileName,sourceProfileType:String(doc.colorProfileType),exported:cfg.delivery};
            if(!alreadyOpen)doc.close(SaveOptions.DONOTSAVECHANGES);return JSON.stringify(info);
        }
        if(cfg.operation==='close-owned') {
            var completed=documentById(cfg.workId);ensure(completed.fullName.fsName===File(cfg.editable).fsName,'Completed path mismatch');completed.close(SaveOptions.DONOTSAVECHANGES);
            var original=documentById(cfg.sourceId);ensure(original.fullName.fsName===File(cfg.source).fsName&&original.saved,'Original source unexpectedly modified');original.close(SaveOptions.DONOTSAVECHANGES);
            return JSON.stringify({success:true,stage:'closed-owned-documents',view:cfg.view});
        }
        throw Error('Unknown operation');
    } catch(e) {return JSON.stringify({success:false,phase:phase,error:String(e),line:e.line});}
    finally {app.preferences.rulerUnits=oldUnits;app.displayDialogs=oldDialogs;}
})();
