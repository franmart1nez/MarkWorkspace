"""Local copy of the reviewed package's generic ZScript test interpreter.
Runs mock commands only; never controls an application. Parts helpers are
from verify_merge.py. No standard plugin installation is required.
"""
"""Execute the delivered ZScript source against a small mock ZBrush host.

This catches control/data-flow regressions; it is NOT the native ZScript
compiler, native renderer, or visual verification. No running app is touched.
"""
from pathlib import Path
import re, struct, tempfile, unittest, json, ast, io, tokenize, operator, random
from functools import lru_cache

_rng=random.Random(310)

def zmath(text, variables):
    # ZScript arithmetic has equal precedence, evaluated left-to-right.
    # Parentheses override it; comparisons/booleans follow grouped arithmetic.
    tokens=[t.string for t in tokenize.generate_tokens(io.StringIO('('+text+')').readline)
            if t.type not in (tokenize.NEWLINE,tokenize.NL,tokenize.ENDMARKER,tokenize.INDENT,tokenize.DEDENT)]
    i=0
    ops={'+':operator.add,'-':operator.sub,'*':operator.mul,'/':operator.truediv,
         '&':operator.and_,'|':operator.or_,'==':operator.eq,'!=':operator.ne,
         '>':operator.gt,'<':operator.lt,'>=':operator.ge,'<=':operator.le,
         'and':lambda a,b:a and b,'or':lambda a,b:a or b}
    levels={k:30 for k in ['+','-','*','/','&','|']}
    levels.update({k:20 for k in ['==','!=','>','<','>=','<=']});levels.update({'and':10,'or':5})
    def expr(minimum=0):
        nonlocal i
        t=tokens[i];i+=1
        if t=='(':
            left=expr();assert tokens[i]==')';i+=1
        elif t in ['INT','IRAND']:
            assert tokens[i]=='(';i+=1
            argument=expr();assert tokens[i]==')';i+=1
            left=int(argument) if t=='INT' else _rng.randint(0,int(argument))
        elif t in ['-','+']:
            left=expr(31);left=-left if t=='-' else left
        elif t in variables:left=variables[t]
        elif t in ('nan','inf'):left=float(t)
        else:left=ast.literal_eval(t)
        while i<len(tokens) and tokens[i] in ops and levels[tokens[i]]>=minimum:
            op=tokens[i];i+=1;right=expr(levels[op]+1);left=ops[op](left,right)
        return left
    result=expr();assert i==len(tokens),(text,tokens[i:]);return result

ROOT=Path(__file__).resolve().parents[1]

def clean(s):
    return re.sub(r'"[^"\n]*"|//[^\n]*',lambda m:'' if m[0].startswith('//') else m[0],s)

def node(s, start):
    args=[]; begin=start+1; level=0; quote=False
    for i in range(start+1,len(s)):
        c=s[i]
        if c=='"': quote=not quote
        if quote: continue
        if c=='[': level+=1
        if c==']':
            if level==0: return args+[s[begin:i].strip()],i+1
            level-=1
        if c==',' and level==0:
            args.append(s[begin:i].strip()); begin=i+1
    raise AssertionError('Unbalanced bracket/string at '+str(start))

@lru_cache(maxsize=4096)
def parse(s):
    s=clean(s); out=[]; i=0
    while i<len(s):
        if s[i].isspace(): i+=1; continue
        if s[i]!='[': raise AssertionError('Unexpected source: '+s[i:i+60])
        n,i=node(s,i); out.append(n)
    return out

class Exit(Exception): pass
class Break(Exception): pass

class Host:
    def __init__(self):
        self.v={}; self.globals=set(); self.mem={}; self.routines={}; self.calls=[]; self.messages=[]; self.exports=[]; self.enabled={}
        self.ui={'Transform:Edit':1,'Transform:Solo':0,'Tool:SubTool:Rename':0,'Draw:Perspective':1,'Draw:Camera':1,
            'Draw:Field Of View(deg)':45,'Draw:Focal Length(mm)':50,'Draw:Crop Factor':1,
            'Draw:Horizontal':1,'Draw:Vertical':0,'Draw:Align To Object':0,'Draw:Auto Adjust Distance':1,
            'Document:Width':1920,'Document:Height':1080,'Document:Pro':1,
            'Material:ItemInfo':0,'Color:R':20,'Color:G':40,'Color:B':60,
            'Render:Render Properties:Shadows':1,'Render:Render Properties:AOcclusion':0,
            'Render:Render Properties:Sss':0,'Render:BPR RenderPass:Reuse Existing Maps':1,
            'Render:Preview':1,'Render:Best':0,'Render:Fast':0,'Render:Flat':0,
            'Document:Export':0,'Render:BPR RenderPass:Render Best Preview':0}
        for i,p in enumerate(['AmOc','Com','Dep','Mask','Img','Shdw','Sss']):
            self.ui['Render:BPR RenderPass:'+p]=2200+i
        self.st=0; self.status=[1,3]; self.pp=[0,1]; self.tx=[1,0]
        self.names=['Part A','Part B'];self.folders=[-1,-1];self.ids=[100,101];self.tool_index=1
        self.pending_name='';self.ask=''
        self.answer=1;self.record_calls=True
        self.mats=['Start','Basic Thor (1)','NormalRGBMat','DoubleShade1','Metal 111','Metal 11']
        self.transform=list(range(9)); self.zoom=1; self.pan=[0,0]; self.nextfile=''
        self.chosen=''; self.dims=[1920,1080]; self.mapready=False
        self.light_on={1556:1,1557:0};self.light_sss={1556:0,1557:0};self.light_selected=1556;self.saved_lights=None
    def arr(self,s):
        m=re.fullmatch(r'(\w+)\((.+)\)',s)
        return (m[1],int(self.e(m[2]))) if m else (s,None)
    def set(self,s,val):
        k,i=self.arr(s)
        if i is None:self.v[k]=val
        else:self.v[k][i]=val
    def e(self,s):
        s=s.strip()
        if not s:return 0
        if s.startswith('"') and s.endswith('"'):return s[1:-1]
        if re.fullmatch(r'\w+',s) and s in self.v:return self.v[s]
        text=''; i=0
        while i<len(s):
            if s[i]=='[':
                n,i=node(s,i); text+=repr(self.cmd(n))
            else:text+=s[i]; i+=1
        text=re.sub(r'\b(\w+)\(([^()]*)\)',lambda m:repr(self.v[m[1]][int(self.e(m[2]))]) if m[1] in self.v and isinstance(self.v[m[1]],list) else m[0],text)
        text=text.replace('&&',' and ').replace('||',' or ')
        return zmath(text,self.v)
    def run(self,s):
        for n in parse(s):self.cmd(n)
    def load(self,p):self.run(p.read_text(encoding='ascii'))
    def call(self,name,*values):
        body,params=self.routines[name]; previous=self.v
        self.v={k:v for k,v in previous.items() if k in self.globals}
        for p,v in zip(params,values):self.v[p]=v
        try:self.run(body)
        finally:
            for k in self.globals:
                if k in self.v:previous[k]=self.v[k]
            self.v=previous
    def ui_get(self,k):
        if k in self.light_on:return self.light_on[k]
        if k=='Light:Lights Properties:Sss':return self.light_sss[self.light_selected]
        if k=='Tool:Polypaint:Colorize':return self.pp[self.st]
        if k=='Tool:Texture Map:Texture On':return self.tx[self.st]
        return self.ui.get(k,0)
    def ui_set(self,k,v):
        if k in self.light_on:self.light_on[k]=v
        elif k=='Light:Lights Properties:Sss':self.light_sss[self.light_selected]=v
        elif k=='Tool:Polypaint:Colorize':self.pp[self.st]=v
        elif k=='Tool:Texture Map:Texture On':self.tx[self.st]=v
        else:self.ui[k]=v
    def cmd(self,n):
        c,*a=n; E=lambda i:self.e(a[i])
        if self.record_calls:self.calls.append((c,list(a)))
        if c=='RoutineDef':self.routines[a[0]]=(a[1],a[2:]);return
        if c=='RoutineCall':return self.call(a[0],*[self.e(x) for x in a[1:]])
        if c=='IFreeze':return self.run(a[0])
        if c=='IEnable':self.enabled[E(0)]=True;return 0
        if c=='IDisable':self.enabled[E(0)]=False;return 0
        if c in ['IButton','ISwitch','ISubPalette','ISetHotkey','IUpdate','Delay','NoteBar']:return 0
        if c=='VarDef':
            k,i=self.arr(a[0]);self.v[k]=[E(1)]*i if i is not None else E(1);self.globals.add(k);return
        if c=='VarSet':self.set(a[0],E(1));return
        if c=='VarInc':self.set(a[0],E(0)+1);return
        if c=='Var':return E(0)
        if c=='If':
            if E(0):return self.run(a[1])
            if len(a)>2:return self.run(a[2])
            return
        if c=='Loop':
            for j in range(int(E(0))):
                if len(a)>2:self.set(a[2],j)
                try:self.run(a[1])
                except Break:break
            return
        if c=='LoopExit':raise Break()
        if c=='Exit':raise Exit()
        if c=='MVarDef':self.mem[a[0]]=bytearray(int(E(1))*4);return E(1)
        if c=='MemCreate':self.mem[a[0]]=bytearray(int(E(1)));return E(1)
        if c=='MemCreateFromFile':
            try:self.mem[a[0]]=bytearray(Path(E(1)).read_bytes())
            except OSError:return -3
            return len(self.mem[a[0]])
        if c=='MemSaveToFile':
            destination=Path(E(1))
            if destination.exists() and len(a)<3:return -2
            try:destination.write_bytes(self.mem[a[0]])
            except OSError:return -3
            return len(self.mem[a[0]])
        if c=='MemGetSize':return len(self.mem.get(a[0],b''))
        if c=='MemDelete':self.mem.pop(a[0],None);return
        if c=='MVarSet':struct.pack_into('<f',self.mem[a[0]],int(E(1))*4,E(2));return
        if c=='MVarGet':
            v=struct.unpack_from('<f',self.mem[a[0]],int(E(1))*4)[0]
            return int(v) if v.is_integer() else v
        if c=='MemCopy':
            self.mem[a[2]][int(E(3)):int(E(3)+E(4))]=self.mem[a[0]][int(E(1)):int(E(1)+E(4))];return
        if c=='MemWriteString':
            b=E(1).encode()+b'\0';self.mem[a[0]][int(E(2)):int(E(2))+len(b)]=b;return len(b)
        if c=='MemReadString':
            assert isinstance(self.v.get(a[1]),str),'MemReadString output must be initialized as a string: '+a[1]
            data=bytes(self.mem[a[0]][int(E(2)):]).split(b'\0')[0]
            if len(a)>3 and E(3):data=data.split(b'\n')[0].split(b'\r')[0]
            self.set(a[1],data[:255].decode());return
        if c=='IExists':
            k=E(0)
            if isinstance(k,int):return int(k in self.light_on or 10000<=k<10000+len(self.mats))
            return int(k in self.ui or k in ['Tool:Polypaint:Colorize','Tool:Texture Map:Texture On'] or k in ['Material:'+m for m in self.mats])
        if c=='IsEnabled':return int(self.enabled.get(E(0),True))
        if c=='IGet':return self.ui_get(E(0))
        if c=='IGetMax':return len(self.mats)-1 if E(0)=='Material:ItemInfo' else 8192
        if c=='IGetMin':return 0
        if c=='ISet':self.ui_set(E(0),E(1));return
        if c=='IUnPress':self.ui_set(E(0),0);return
        if c=='IPress':
            k=E(0)
            if k=='Tool:SubTool:Rename':self.names[self.st]=self.pending_name;self.pending_name='';return
            if k=='Light:Save':
                self.saved_lights=(self.light_on.copy(),self.light_sss.copy(),self.light_selected);Path(self.nextfile).write_bytes(b'light backup');return
            if k=='Light:Load':self.light_on,self.light_sss,self.light_selected=self.saved_lights;return
            if isinstance(k,int) and 10000<=k<10000+len(self.mats):self.ui['Material:ItemInfo']=k-10000;return
            if k=='Document:Resize':self.dims=[self.ui['Document:Width'],self.ui['Document:Height']]
            if k=='Render:BPR RenderPass:Render Best Preview':self.mapready=True
            if k=='Document:Export' or isinstance(k,int):
                Path(self.nextfile).write_bytes(b'mock only')
                self.exports.append({'path':self.nextfile,'dims':self.dims[:],'material':self.mats[int(self.ui['Material:ItemInfo'])],
                    'color':[self.ui['Color:'+v] for v in 'RGB'],'shadow':self.ui['Render:Render Properties:Shadows'],
                    'ao':self.ui['Render:Render Properties:AOcclusion'],'sss':self.ui['Render:Render Properties:Sss'],
                    'pp':self.pp[:],'tx':self.tx[:],
                    'visibility':[status&1 for status in self.status],'selected':self.st,'solo':self.ui['Transform:Solo']})
            if k in self.ui:self.ui_set(k,1)
            return
        if c=='IKeyPress':return self.run(a[1])
        if c=='IColorSet':
            for i,k in enumerate('RGB'):self.ui['Color:'+k]=E(i)
            return
        if c=='IGetTitle':
            k=E(0)
            if k=='Tool:ItemInfo':return self.names[self.st]+'.'
            if k in self.light_on:return 'Light:Light Switch'
            if isinstance(k,int):return ('Material:' if len(a)>1 and E(1) else '')+self.mats[k-10000]
            return self.mats[int(self.ui['Material:ItemInfo'])]+'.'
        if c=='IGetID':
            k=E(0)
            if k=='Light:Light Switch':return 1556
            if k.startswith('Material:'):return 10000+self.mats.index(k[len('Material:'):])
            return self.ui[k]
        if c=='IGetInfo':return 'Width=1920 Height=1080' if self.mapready else 'No image'
        if c=='SubToolGetCount':return len(self.status)
        if c=='SubToolGetStatus':return self.status[int(E(0))]
        if c=='SubToolSetStatus':self.status[int(E(0))]=int(E(1));return
        if c=='SubToolGetID':return self.ids[int(E(0))]
        if c=='SubToolGetFolderIndex':return self.folders[int(E(0))]
        if c=='ToolGetActiveIndex':return self.tool_index
        if c=='ToolGetPath':return getattr(self,'tool_path','')
        if c=='FileNameExtract':
            filename=E(0).replace('\\','/').rsplit('/',1)[-1]
            if E(1)==6:return filename
            if E(1)==2:return filename.rsplit('.',1)[0]
            raise NotImplementedError(n)
        if c=='SubToolGetActiveIndex':return self.st
        if c=='SubToolSelect':self.st=int(E(0));return
        if c=='MTransformGet':
            struct.pack_into('<9f',self.mem[a[0]],int(E(1))*4,*self.transform);return
        if c=='MTransformSet':self.transform=list(struct.unpack_from('<9f',self.mem[a[0]],int(E(1))*4));return
        if c=='CanvasZoomGet':return self.zoom
        if c=='CanvasZoomSet':self.zoom=E(0);return
        if c=='CanvasPanGetH':return self.pan[0]
        if c=='CanvasPanGetV':return self.pan[1]
        if c=='CanvasPanSet':self.pan=[E(0),E(1)];return
        if c=='CanvasClick':return
        if c=='StrLength':return len(E(0))
        if c=='StrFind':return E(1).find(E(0))
        if c=='StrLower':return E(0).lower()
        if c=='StrToAsc':return ord(E(0)[int(E(1)) if len(a)>1 else 0])
        if c=='StrExtract':return E(0)[int(E(1)):int(E(2))+1]
        if c=='StrMerge':
            if not 2<=len(a)<=12:raise ValueError(f'StrMerge requires 2..12 inputs; got {len(a)}')
            return ''.join(str(self.e(x)) for x in a)
        if c in ['MessageOK','Note']:self.messages.append(E(0));return 1
        if c=='MessageYesNo':return self.answer
        if c=='FileNameAsk':return self.ask
        if c=='FileNameSetNext':self.nextfile=E(0);return
        if c=='IClick':self.light_selected=E(0);return
        if c=='FileDelete':Path(E(0)).unlink();return 0
        if c=='FileExists':return int(Path(E(0)).exists() or E(0).endswith('.dll'))
        if c=='FileNameResolvePath':return E(0)
        if c=='FileExecute':
            name=E(1)
            if name=='Version':return 8
            if name=='RenameSetNext':self.pending_name=E(2);return 0
            if name=='FolderExists':return int(Path(E(2)).is_dir())
            if name=='MakeFolder':Path(E(2)).mkdir();return 0
            if name=='ChooseFolder':self.mem[a[4]][:len(self.chosen)+1]=self.chosen.encode()+b'\0';return 0
            if name=='FileCopyTo':
                destination=bytes(self.mem[a[4]]).split(b'\0')[0].decode()
                try:Path(destination).write_bytes(Path(E(2)).read_bytes())
                except OSError:return 1
                return 0
        raise NotImplementedError(n)


def parts(h,names,status=None,selected=0):
    h.names=list(names);h.status=list(status or [1]*len(names));h.st=selected
    h.folders=[-1]*len(names);h.ids=[9000+i for i in range(len(names))]
    h.pp=[0]*len(names);h.tx=[1]*len(names)

def get(h,index):return struct.unpack_from('<f',h.mem['CB25Data'],index*4)[0]
