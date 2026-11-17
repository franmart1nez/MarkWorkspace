"""Office Level Builder (OLB) - Total (in)Sanitation.

Editor-only generator for 4 m modular levels like the Basement, aimed at the
Office floors. It reads three marker Blueprints placed in the current level:

  BP_OLB_Builder  piece selection (walls, corner, floors, ceilings, lit ceiling)
  BP_OLB_Room     a rectangle of 4 m cells (actor scale = cells); touching rooms merge
  BP_OLB_Stair    1 x 2 cell stair; the arrow points downhill, placed on the upper floor

and spawns the owner's ordinary modular Blueprint actors (as in the Basement).
Walls go on every edge between a room cell and empty space, facing into the room,
with their 15 cm thickness outside the room. Where two walls meet at an open
(convex) corner their thickness overlaps; one of them becomes the shorter 385 cm
"corner" Blueprint so the faces do not Z-fight (mirrored with X scale -1 when the
short end must be at the wall's start, exactly as in the Basement).

Run from the Builder/Room/Stair "Build" button, or the Cmd box:
  py import runpy,unreal; runpy.run_path(unreal.Paths.convert_relative_path_to_full(
     unreal.Paths.project_content_dir())+'Art/Tools/OfficeLevelBuilder/Python/olb_build.py',
     init_globals={'OLB_ACTION':'build'})
OLB_ACTION: 'build' (default) or 'clear'. Optional OLB_GROUPS: list of group names.
Without OLB_GROUPS it uses the groups of the selected OLB actors, else every group.
Everything happens in one undo transaction (Ctrl+Z reverts a build).
"""
import zlib
import unreal

CELL = 400.0
LEVEL_H = 400.0
TOOL = '/Game/Art/Tools/OfficeLevelBuilder/'
WALLS_DIR = '/Game/Art/Assets/Building/Modular_Blocks/BP_Modular_Walls'
GEN_TAG = 'OLB_Generated'

ACTION = globals().get('OLB_ACTION', 'build')
FORCED_GROUPS = globals().get('OLB_GROUPS')

# yaw, pivot offset (cells) from the cell's min corner, thickness-side neighbour
SIDES = {
    'S': (0.0, (0, 0), (0, -1)),
    'E': (90.0, (1, 0), (1, 0)),
    'N': (180.0, (1, 1), (0, 1)),
    'W': (-90.0, (0, 1), (-1, 0)),
}
DIR_OF = {(0, 1): 0.0, (-1, 0): 90.0, (0, -1): 180.0, (1, 0): -90.0}  # stair downhill -> yaw


def log(msg):
    unreal.log('OLB: ' + msg)


def warn(msg):
    unreal.log_warning('OLB: ' + msg)


def load_cls(name):
    return unreal.load_class(None, f'{TOOL}{name}.{name}_C')


def prop(actor, name, default=None):
    try:
        return actor.get_editor_property(name)
    except Exception:
        return default


def pick(classes, key):
    classes = [c for c in (classes or []) if c]
    if not classes:
        return None
    return classes[zlib.crc32(key.encode()) % len(classes)]


_corner_cache = {}


def family_corner(wall_cls):
    """BP_Wall_Wood_02 -> BP_Wall_Wood_Corner_01 when that Blueprint exists."""
    if wall_cls is None:
        return None
    name = wall_cls.get_name()[:-2] if wall_cls.get_name().endswith('_C') else wall_cls.get_name()
    if name in _corner_cache:
        return _corner_cache[name]
    found = None
    parts = name.split('_')
    if '_Corner_' in name:
        found = wall_cls
    elif len(parts) >= 3:
        base = '_'.join(parts[:-1])
        reg = unreal.AssetRegistryHelpers.get_asset_registry()
        cands = sorted(str(a.asset_name) for a in reg.get_assets_by_path(WALLS_DIR, recursive=True)
                       if str(a.asset_name).startswith(base + '_Corner_'))
        if cands:
            found = unreal.load_class(None, f'{WALLS_DIR}/{cands[0]}.{cands[0]}_C')
    _corner_cache[name] = found
    return found


class Settings:
    """Room value if set, otherwise the builder's."""

    def __init__(self, builder, room=None):
        self.b, self.r = builder, room

    def get(self, name):
        if self.r is not None:
            v = prop(self.r, name)
            if name in ('LightSpacingX', 'LightSpacingY'):
                if v is not None and v >= 0:
                    return v
            elif v:
                return v
        return prop(self.b, name)


def snapped_rect(actor, ox, oy, local_w, local_h):
    """World rectangle of a local (0..w, 0..h) footprint in cells, snapped to the grid."""
    xf = actor.get_actor_transform()
    pts = [xf.transform_location(unreal.Vector(x, y, 0)) for x in (0, local_w) for y in (0, local_h)]
    x0 = round((min(p.x for p in pts) - ox) / CELL)
    x1 = round((max(p.x for p in pts) - ox) / CELL)
    y0 = round((min(p.y for p in pts) - oy) / CELL)
    y1 = round((max(p.y for p in pts) - oy) / CELL)
    if x1 <= x0:
        x1 = x0 + 1
    if y1 <= y0:
        y1 = y0 + 1
    return x0, y0, x1, y1


class Matcher:
    """Each overlap conflict needs one of its two walls shortened; a wall can only be shortened once."""

    def __init__(self, conflicts):
        self.conflicts = conflicts
        self.owner = {}  # wall id -> conflict index

    def _try(self, ci, seen):
        for wid, _end in self.conflicts[ci]['options']:
            if wid in seen:
                continue
            seen.add(wid)
            if wid not in self.owner or self._try(self.owner[wid], seen):
                self.owner[wid] = ci
                return True
        return False

    def solve(self):
        order = sorted(range(len(self.conflicts)), key=lambda c: len(self.conflicts[c]['options']))
        failed = [ci for ci in order if not self._try(ci, set())]
        return failed


def build_group(group, builder, rooms, stairs, eas):
    origin = builder.get_actor_location()
    ox, oy, oz = origin.x, origin.y, origin.z
    seed = prop(builder, 'RandomSeed', 0) or 0
    report = {'walls': 0, 'corners': 0, 'floors': 0, 'ceilings': 0, 'stairs': 0, 'warnings': []}

    # ---------------------------------------------------------------- cells
    cells = {}  # (k, i, j) -> (priority, -area, room)
    cover = {}  # (k, i, j) -> [(rank, room), ...] every room over the cell
    rects = {}  # room -> snapped (x0, y0, x1, y1)
    for room in rooms:
        x0, y0, x1, y1 = snapped_rect(room, ox, oy, CELL, CELL)
        k = round((room.get_actor_location().z - oz) / LEVEL_H)
        rot = room.get_actor_rotation()
        room.set_actor_location_and_rotation(
            unreal.Vector(ox + x0 * CELL, oy + y0 * CELL, oz + k * LEVEL_H),
            unreal.Rotator(pitch=0, yaw=0, roll=0), False, False)
        room.set_actor_scale3d(unreal.Vector(x1 - x0, y1 - y0, 1))
        if abs(rot.pitch) > 0.1 or abs(rot.roll) > 0.1:
            report['warnings'].append(f'{room.get_actor_label()}: pitch/roll ignored')
        rank = (prop(room, 'Priority', 0) or 0, -(x1 - x0) * (y1 - y0))
        rects[room] = (x0, y0, x1, y1)
        for i in range(x0, x1):
            for j in range(y0, y1):
                cover.setdefault((k, i, j), []).append((rank, room))
                cur = cells.get((k, i, j))
                if cur is None or rank >= cur[0]:
                    cells[(k, i, j)] = (rank, room)

    # ---------------------------------------------------------------- stairs
    stair_cells = {}  # (k, i, j) -> info, for both the upper (k) and lower (k-1) floor
    fixed = []  # stair side walls (cannot be shortened): (k, thickness cell, v0, v1)
    stair_spawns = []
    for st in stairs:
        loc = st.get_actor_location()
        yaw = round(st.get_actor_rotation().yaw / 90.0) * 90.0
        st.set_actor_rotation(unreal.Rotator(pitch=0, yaw=yaw, roll=0), False)
        st.set_actor_scale3d(unreal.Vector(1, 1, 1))
        xf = st.get_actor_transform()
        ca = xf.transform_location(unreal.Vector(200, 200, 0))
        cb = xf.transform_location(unreal.Vector(200, 600, 0))
        a = (int((ca.x - ox) // CELL), int((ca.y - oy) // CELL))
        b = (int((cb.x - ox) // CELL), int((cb.y - oy) // CELL))
        d = (b[0] - a[0], b[1] - a[1])
        k = round((loc.z - oz) / LEVEL_H)
        yaw = DIR_OF[d]
        # snap the marker so it covers exactly cells a, b
        c = unreal.Vector(ox + (a[0] + b[0] + 1) * CELL / 2, oy + (a[1] + b[1] + 1) * CELL / 2, oz + k * LEVEL_H)
        pivot = c - rot2d(yaw, 200, 400)
        st.set_actor_location(pivot, False, False)
        stair_cls = prop(st, 'StairClass')
        if not stair_cls:
            report['warnings'].append(f'{st.get_actor_label()}: no StairClass')
            continue
        partner = pivot + rot2d(yaw, 400, 800)
        stair_spawns.append((stair_cls, pivot, yaw, unreal.Vector(1, 1, 1), f'{k}_{a[0]}_{a[1]}'))
        stair_spawns.append((stair_cls, partner, yaw + 180.0, unreal.Vector(1, 1, -1), f'{k}_{a[0]}_{a[1]}_ceiling'))
        side = (d[1], -d[0])
        for lvl, open_edge in ((k, (a, (a[0] - d[0], a[1] - d[1]))), (k - 1, (b, (b[0] + d[0], b[1] + d[1])))):
            for cc in (a, b):
                stair_cells[(lvl, cc[0], cc[1])] = {'open': open_edge, 'side': side}
                cells.pop((lvl, cc[0], cc[1]), None)
            for cc in (a, b):
                for s in (side, (-side[0], -side[1])):
                    nb = (cc[0] + s[0], cc[1] + s[1])
                    v0, v1 = edge_vertices(cc, s)
                    fixed.append((lvl, nb, v0, v1))
        report['stairs'] += 1

    # ---------------------------------------------------------------- walls
    walls = []  # dict(k, cell, side, room, start(v), end(v), thick)
    for (k, i, j), (_rank, room) in cells.items():
        for side, (yaw, piv, nb) in SIDES.items():
            n = (i + nb[0], j + nb[1])
            if (k, n[0], n[1]) in cells:
                continue
            sc = stair_cells.get((k, n[0], n[1]))
            if sc is not None:
                if {tuple(sc['open'][0]), tuple(sc['open'][1])} == {n, (i, j)}:
                    continue  # walk onto the stair
                if abs(nb[0]) == abs(sc['side'][0]) and abs(nb[1]) == abs(sc['side'][1]):
                    report['warnings'].append(f'L{k} cell {i},{j}: room touches a stair side (stair wall back face visible)')
                    continue
            start = (i + piv[0], j + piv[1])
            ang = {0.0: (1, 0), 90.0: (0, 1), 180.0: (-1, 0), -90.0: (0, -1)}[yaw]
            end = (start[0] + ang[0], start[1] + ang[1])
            walls.append({'k': k, 'cell': (i, j), 'side': side, 'yaw': yaw, 'room': room,
                          'start': start, 'end': end, 'thick': n, 'short': None})

    # ---------------------------------------------------------------- open-corner conflicts
    by_thick = {}
    for wid, w in enumerate(walls):
        by_thick.setdefault((w['k'], w['thick']), []).append(('w', wid, w['start'], w['end']))
    for (k, nb, v0, v1) in fixed:
        by_thick.setdefault((k, nb), []).append(('f', None, v0, v1))
    conflicts = []
    for key, items in by_thick.items():
        for x in range(len(items)):
            for y in range(x + 1, len(items)):
                A, B = items[x], items[y]
                shared = {A[2], A[3]} & {B[2], B[3]}
                if not shared:
                    continue
                v = shared.pop()
                opts = [(it[1], 'start' if it[2] == v else 'end') for it in (A, B) if it[0] == 'w']
                if opts:
                    conflicts.append({'k': key[0], 'v': v, 'options': opts})
    m = Matcher(conflicts)
    for ci in m.solve():
        c = conflicts[ci]
        report['warnings'].append(f"L{c['k']} vertex {c['v']}: no wall left to shorten (possible Z-fighting)")
    for wid, ci in m.owner.items():
        walls[wid]['short'] = [e for w_, e in conflicts[ci]['options'] if w_ == wid][0]

    # ---------------------------------------------------------------- spawn
    def spawn(cls, loc, yaw, scale, kind, label, k):
        actor = eas.spawn_actor_from_class(cls, loc, unreal.Rotator(pitch=0, yaw=yaw, roll=0))
        if not actor:
            report['warnings'].append(f'could not spawn {label}')
            return None
        if scale is not None:
            actor.set_actor_scale3d(scale)
        actor.tags = [unreal.Name(GEN_TAG), unreal.Name('OLB_Group_' + group)]
        actor.set_actor_label(f'OLB_{group}_L{k}_{kind}_{label}')
        actor.set_folder_path(f'OfficeBuilder/{group}/L{k}/{kind}s')
        return actor

    def world(k, v):
        return unreal.Vector(ox + v[0] * CELL, oy + v[1] * CELL, oz + k * LEVEL_H)

    for w in walls:
        st = Settings(builder, w['room'])
        key = f"{seed}:{w['k']}:{w['cell'][0]}:{w['cell'][1]}:{w['side']}"
        wall_cls = pick(st.get('WallClasses'), key)
        if wall_cls is None:
            report['warnings'].append('no WallClasses set')
            break
        label = f"{w['cell'][0]}_{w['cell'][1]}_{w['side']}"
        if w['short']:
            # room's explicit corner > corner of the chosen wall's family > builder's corner
            corner_cls = (prop(w['room'], 'CornerClass') or family_corner(wall_cls)
                          or prop(builder, 'CornerClass'))
            if corner_cls is None:
                report['warnings'].append(f'{label}: no corner Blueprint for {wall_cls.get_name()}')
                corner_cls = wall_cls
            if w['short'] == 'end':
                spawn(corner_cls, world(w['k'], w['start']), w['yaw'], None, 'Corner', label, w['k'])
            else:  # short end at the start: pivot at the end, mirrored (Basement convention)
                spawn(corner_cls, world(w['k'], w['end']), w['yaw'], unreal.Vector(-1, 1, 1), 'Corner', label, w['k'])
            report['corners'] += 1
        else:
            spawn(wall_cls, world(w['k'], w['start']), w['yaw'], None, 'Wall', label, w['k'])
            report['walls'] += 1

    def light_room(cell):
        """Highest-priority covering room that sets its own lights, else the base (lowest) room.
        A rug/priority patch without light settings keeps the surrounding room's light pattern."""
        stack = sorted(cover[cell], key=lambda rr: rr[0], reverse=True)
        for _rank, r in stack:
            own_x = prop(r, 'LightSpacingX', -1)
            own_y = prop(r, 'LightSpacingY', -1)
            own_class = prop(r, 'CeilingLightClass')
            if (own_x is not None and own_x >= 0) or (own_y is not None and own_y >= 0) or own_class:
                return r
        return stack[-1][1]

    def on_axis(n, lo, hi, step):
        """Every `step` cells along one axis, centred in the room; a room narrower than the
        step (e.g. a 1-cell corridor across its width) gets its centre row."""
        if not step or step <= 0:
            return False
        size = hi - lo
        return (n - lo - ((size - 1) % step) // 2) % step == 0

    for (k, i, j), (_rank, room) in sorted(cells.items(), key=lambda kv: kv[0]):
        st = Settings(builder, room)
        key = f'{seed}:{k}:{i}:{j}'
        floor_cls = pick(st.get('FloorClasses'), key + ':floor')
        if floor_cls:
            spawn(floor_cls, world(k, (i, j)), 0.0, None, 'Floor', f'{i}_{j}', k)
            report['floors'] += 1
        lr = light_room((k, i, j))
        lst = Settings(builder, lr)
        x0, y0, x1, y1 = rects[lr]
        lit = on_axis(i, x0, x1, lst.get('LightSpacingX') or 0) and on_axis(j, y0, y1, lst.get('LightSpacingY') or 0)
        ceil_cls = lst.get('CeilingLightClass') if lit else None
        ceil_cls = ceil_cls or pick(st.get('CeilingClasses'), key + ':ceiling')
        if ceil_cls:
            spawn(ceil_cls, world(k, (i, j)), 0.0, None, 'Ceiling', f'{i}_{j}', k)
            report['ceilings'] += 1

    for cls, loc, yaw, scale, label in stair_spawns:
        spawn(cls, loc, yaw, scale, 'Stair', label, round((loc.z - oz) / LEVEL_H))
    return report


def rot2d(yaw, x, y):
    """Rotate a local XY offset by a multiple of 90 degrees of yaw."""
    c, s = {0: (1, 0), 90: (0, 1), 180: (-1, 0), 270: (0, -1)}[int(round(yaw)) % 360]
    return unreal.Vector(x * c - y * s, x * s + y * c, 0)


def edge_vertices(cell, s):
    """Grid vertices of the edge of `cell` on side direction s."""
    i, j = cell
    if s == (1, 0):
        return (i + 1, j), (i + 1, j + 1)
    if s == (-1, 0):
        return (i, j), (i, j + 1)
    if s == (0, 1):
        return (i, j + 1), (i + 1, j + 1)
    return (i, j), (i + 1, j)


def main():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    b_cls, r_cls, s_cls = load_cls('BP_OLB_Builder'), load_cls('BP_OLB_Room'), load_cls('BP_OLB_Stair')

    def group_of(a):
        return str(prop(a, 'Group', '') or 'Office')

    builders = {}
    for b in unreal.GameplayStatics.get_all_actors_of_class(world, b_cls):
        g = group_of(b)
        if g in builders:
            warn(f'more than one Builder for group "{g}"; using {builders[g].get_actor_label()}')
            continue
        builders[g] = b
    if FORCED_GROUPS:
        groups = set(FORCED_GROUPS)
    else:
        sel = [a for a in eas.get_selected_level_actors() if a.get_class() in (b_cls, r_cls, s_cls)]
        groups = {group_of(a) for a in sel} or set(builders)
    if not groups:
        warn('no BP_OLB_Builder in the level. Drag one in from /Game/Art/Tools/OfficeLevelBuilder.')
        return

    rooms = unreal.GameplayStatics.get_all_actors_of_class(world, r_cls)
    stairs = unreal.GameplayStatics.get_all_actors_of_class(world, s_cls)
    generated = [a for a in unreal.GameplayStatics.get_all_actors_with_tag(world, GEN_TAG)]

    with unreal.ScopedEditorTransaction(f'Office Level Builder: {ACTION}'):
        for g in sorted(groups):
            old = [a for a in generated if unreal.Name('OLB_Group_' + g) in a.tags]
            if old:
                eas.destroy_actors(old)
            if ACTION == 'clear':
                log(f'group "{g}": cleared {len(old)} actors')
                continue
            builder = builders.get(g)
            if builder is None:
                warn(f'group "{g}" has rooms but no Builder')
                continue
            rep = build_group(g, builder,
                              [r for r in rooms if group_of(r) == g],
                              [s for s in stairs if group_of(s) == g], eas)
            log(f'group "{g}": removed {len(old)}, walls {rep["walls"]}, corners {rep["corners"]}, '
                f'floors {rep["floors"]}, ceilings {rep["ceilings"]}, stairs {rep["stairs"]}')
            for w in rep['warnings']:
                warn(f'group "{g}": {w}')
            globals()['OLB_LAST_REPORT'] = rep


main()
