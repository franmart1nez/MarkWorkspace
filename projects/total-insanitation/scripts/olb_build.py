"""Office Level Builder (OLB) - Total (in)Sanitation.

Editor-only generator for 4 m modular levels like the Basement, aimed at the
Office floors. It reads three marker Blueprints placed in the current level:

  BP_OLB_Builder  piece selection (walls, corner, floors, ceilings, lit ceiling)
  BP_OLB_Room     a volume of 4 m cells (actor scale = cells); ordinary rooms merge
  BP_OLB_Stair    1 x 2 cell stair; the arrow points downhill, placed on the upper floor

and spawns the owner's ordinary modular Blueprint actors (as in the Basement).
Walls face the occupied cell at the outside of a room and at changes in ceiling
height. Enclosed Room markers add a partition and their own floor and ceiling
within an ordinary room. Keep Shared Walls gives two touching rooms one wall
each. Priority sets which room keeps its face on the grid line. Where two walls meet at an open
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
from dataclasses import dataclass
import unreal

CELL = 400.0
LEVEL_H = 400.0
WALL_THICKNESS = 15.0
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
        for wid, _end, _amount in self.conflicts[ci]['options']:
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


@dataclass(frozen=True)
class RoomVolume:
    actor: object
    rect: tuple
    bottom: int
    top: int
    rank: tuple
    enclosed: bool
    keep_shared_walls: bool

    def positions(self):
        x0, y0, x1, y1 = self.rect
        for k in range(self.bottom, self.top):
            for i in range(x0, x1):
                for j in range(y0, y1):
                    yield k, i, j

    def contains(self, inner):
        x0, y0, x1, y1 = self.rect
        ix0, iy0, ix1, iy1 = inner.rect
        return (self.rect != inner.rect and x0 <= ix0 < ix1 <= x1 and y0 <= iy0 < iy1 <= y1
                and self.bottom <= inner.bottom < inner.top <= self.top)

    def overlaps(self, other):
        x0, y0, x1, y1 = self.rect
        ox0, oy0, ox1, oy1 = other.rect
        return (x0 < ox1 and ox0 < x1 and y0 < oy1 and oy0 < y1
                and self.bottom < other.top and other.bottom < self.top)


def room_cells(rooms, origin, warnings):
    volumes = []
    for room in rooms:
        x0, y0, x1, y1 = snapped_rect(room, origin.x, origin.y, CELL, CELL)
        k = round((room.get_actor_location().z - origin.z) / LEVEL_H)
        height = max(1, round(room.get_actor_scale3d().z))
        rot = room.get_actor_rotation()
        room.set_actor_location_and_rotation(
            unreal.Vector(origin.x + x0 * CELL, origin.y + y0 * CELL, origin.z + k * LEVEL_H),
            unreal.Rotator(pitch=0, yaw=0, roll=0), False, False)
        room.set_actor_scale3d(unreal.Vector(x1 - x0, y1 - y0, height))
        if abs(rot.pitch) > 0.1 or abs(rot.roll) > 0.1:
            warnings.append(f'{room.get_actor_label()}: pitch/roll ignored')
        rank = (prop(room, 'Priority', 0) or 0, -(x1 - x0) * (y1 - y0))
        volumes.append(RoomVolume(room, (x0, y0, x1, y1), k, k + height, rank,
                                  bool(prop(room, 'EnclosedRoom', False)),
                                  bool(prop(room, 'KeepSharedWalls', False))))

    open_rooms = [room for room in volumes if not room.enclosed]
    cover = {}
    for room in open_rooms:
        for pos in room.positions():
            cover.setdefault(pos, []).append(room)
    # Later markers win tied piece priorities, as in the original builder.
    cells = {pos: max(reversed(stack), key=lambda room: room.rank) for pos, stack in cover.items()}

    enclosed_rooms = []
    for room in volumes:
        if not room.enclosed:
            continue
        if any(outer.contains(room) for outer in open_rooms):
            enclosed_rooms.append(room)
        else:
            warnings.append(f'{room.actor.get_actor_label()}: Enclosed Room needs a larger room '
                            'in this group that contains its footprint and height')
    for room in enclosed_rooms:
        if any(room is not other and room.overlaps(other) for other in enclosed_rooms):
            warnings.append(f'{room.actor.get_actor_label()}: overlapping Enclosed Rooms; room skipped')
            continue
        for pos in room.positions():
            cells[pos] = room
    return cells, cover


def shared_wall_edges(cells, cover, stair_cells):
    """Find opted-in boundaries and align any extensions above or below them."""
    shared = {}
    extensions = {}
    for (k, i, j), room in cells.items():
        left = (room,) if room.enclosed else cover[(k, i, j)]
        if not any(r.keep_shared_walls for r in left):
            continue
        for side, opposite in (('E', 'W'), ('N', 'S')):
            dx, dy = SIDES[side][2]
            x, y = i + dx, j + dy
            neighbor = cells.get((k, x, y))
            if neighbor is None or neighbor.enclosed != room.enclosed:
                continue
            right = (neighbor,) if neighbor.enclosed else cover[(k, x, y)]
            if not any(r.keep_shared_walls for r in right) or set(left).intersection(right):
                continue  # overlapping markers still act as one open room

            left_priority = max(r.rank[0] for r in left if r.keep_shared_walls)
            right_priority = max(r.rank[0] for r in right if r.keep_shared_walls)
            # Keep the higher priority face on the grid. The lower room takes
            # both modules' thickness. Equal priorities center the partition.
            left_inset = WALL_THICKNESS
            if left_priority > right_priority:
                left_inset = 0
            elif left_priority < right_priority:
                left_inset = 2 * WALL_THICKNESS
            for u, v, edge, stack, inset in ((i, j, side, left, left_inset),
                                            (x, y, opposite, right, 2 * WALL_THICKNESS - left_inset)):
                shared[k, u, v, edge] = inset
                ex, ey = SIDES[edge][2]
                spans = (range(k - 1, min(r.bottom for r in stack) - 1, -1),
                         range(k + 1, max(r.top for r in stack)))
                for span in spans:
                    for band in span:
                        own = cells.get((band, u, v))
                        other_pos = (band, u + ex, v + ey)
                        other = cells.get(other_pos)
                        if own is None or own.enclosed != room.enclosed or other_pos in stair_cells:
                            break
                        if other is not None and (not own.enclosed or other.enclosed):
                            break
                        extended = (band, u, v, edge)
                        # A tall room between two shorter neighbors can have
                        # different insets at either end. Use the nearer join.
                        candidate = (abs(band - k), k, inset)
                        if extended not in extensions or candidate < extensions[extended]:
                            extensions[extended] = candidate
    return {**{edge: entry[2] for edge, entry in extensions.items()}, **shared}


def wall_bounds(start, end, thick_cell, inset):
    """XY bounds of the 15 cm wall body before resolving corner overlaps."""
    thickness_axis = 0 if start[0] == end[0] else 1
    spans = [(min(a, b) * CELL, max(a, b) * CELL) for a, b in zip(start, end)]
    line = start[thickness_axis] * CELL
    if thick_cell[thickness_axis] >= start[thickness_axis]:
        spans[thickness_axis] = (line, line + WALL_THICKNESS)
    else:
        spans[thickness_axis] = (line - WALL_THICKNESS, line)
    # Inset walls occupy their own cell. For 15 cm the original line is their
    # back, and for 30 cm their back is already one thickness inside that cell.
    if inset > WALL_THICKNESS:
        lo, hi = spans[thickness_axis]
        offset = WALL_THICKNESS if lo == line else -WALL_THICKNESS
        spans[thickness_axis] = (lo + offset, hi + offset)
    return spans


def corner_cut(start, end, vertex, other_bounds):
    """Distance from the corner endpoint to the far side of the crossing wall."""
    axis = 0 if start[0] != end[0] else 1
    lo, hi = other_bounds[axis]
    coordinate = vertex[axis] * CELL
    return hi - coordinate if vertex[axis] == min(start[axis], end[axis]) else coordinate - lo


@dataclass(frozen=True)
class WallSegment:
    wall_id: int | None
    start: tuple
    end: tuple
    inset: float = 0
    shared: bool = False

    @property
    def length_axis(self):
        return 0 if self.start[0] != self.end[0] else 1

    def cut_at(self, vertex, amount):
        return self.wall_id, 'start' if self.start == vertex else 'end', amount


def build_group(group, builder, rooms, stairs, eas):
    origin = builder.get_actor_location()
    ox, oy, oz = origin.x, origin.y, origin.z
    seed = prop(builder, 'RandomSeed', 0) or 0
    report = {'walls': 0, 'corners': 0, 'floors': 0, 'ceilings': 0, 'stairs': 0, 'warnings': []}

    # ---------------------------------------------------------------- cells
    cells, cover = room_cells(rooms, origin, report['warnings'])
    enclosed_cells = {pos for pos, room in cells.items() if room.enclosed}

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
        upper_landing = (a[0] - d[0], a[1] - d[1])
        lower_landing = (b[0] + d[0], b[1] + d[1])
        stair_levels = ((k, (a, upper_landing)), (k - 1, (b, lower_landing)))
        if any((lvl, *cell) in enclosed_cells
               for lvl, (_, landing) in stair_levels for cell in (a, b, landing)):
            report['warnings'].append(f'{st.get_actor_label()}: stair crosses an Enclosed Room; stair skipped')
            continue
        partner = pivot + rot2d(yaw, 400, 800)
        stair_spawns.append((stair_cls, pivot, yaw, unreal.Vector(1, 1, 1), f'{k}_{a[0]}_{a[1]}'))
        stair_spawns.append((stair_cls, partner, yaw + 180.0, unreal.Vector(1, 1, -1), f'{k}_{a[0]}_{a[1]}_ceiling'))
        side = (d[1], -d[0])
        for lvl, open_edge in stair_levels:
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
    shared_offsets = shared_wall_edges(cells, cover, stair_cells)
    walls = []  # dict(k, cell, side, room, start(v), end(v), thick)
    for (k, i, j), room in cells.items():
        for side, (yaw, piv, nb) in SIDES.items():
            edge = (k, i, j, side)
            shared_edge = edge in shared_offsets
            inset = shared_offsets.get(edge, 0)
            n = (i + nb[0], j + nb[1])
            neighbor = cells.get((k, *n))
            if neighbor is not None and not shared_edge:
                if not room.enclosed or neighbor is room:
                    continue
                if neighbor.enclosed and (i, j) > n:
                    continue  # neighboring enclosures share one wall
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
            wall_room = room.actor
            if shared_edge and not room.enclosed and not prop(wall_room, 'WallClasses'):
                # A floor-only patch leaves the underlying room's partition finish.
                candidates = (r for r in reversed(cover[(k, i, j)]) if prop(r.actor, 'WallClasses'))
                wall_room = max(candidates, key=lambda r: r.rank, default=room).actor
            walls.append({'k': k, 'cell': (i, j), 'side': side, 'yaw': yaw, 'room': wall_room,
                          'start': start, 'end': end, 'thick': (i, j) if inset else n,
                          'inset': inset, 'shared': shared_edge, 'cuts': {}})

    # ---------------------------------------------------------------- open-corner conflicts
    by_thick = {}
    for wid, w in enumerate(walls):
        by_thick.setdefault((w['k'], w['thick']), []).append(
            WallSegment(wid, w['start'], w['end'], w['inset'], w['shared']))
    for (k, nb, v0, v1) in fixed:
        by_thick.setdefault((k, nb), []).append(WallSegment(None, v0, v1))
    conflicts = []
    for key, items in by_thick.items():
        asymmetric_vertices = {vertex for item in items if item.shared and item.inset != WALL_THICKNESS
                               for vertex in (item.start, item.end)}
        offset_corners = {}
        for x, a in enumerate(items):
            for b in items[x + 1:]:
                shared = {a.start, a.end} & {b.start, b.end}
                if not shared:
                    continue
                v = shared.pop()
                if a.shared or b.shared or v in asymmetric_vertices:
                    a_bounds = wall_bounds(a.start, a.end, key[1], a.inset)
                    b_bounds = wall_bounds(b.start, b.end, key[1], b.inset)
                    if any(min(aa[1], bb[1]) <= max(aa[0], bb[0]) for aa, bb in zip(a_bounds, b_bounds)):
                        continue
                    if v in asymmetric_vertices:
                        offset_corners.setdefault(v, []).append(((a, b_bounds), (b, a_bounds)))
                        continue
                opts = [item.cut_at(v, WALL_THICKNESS) for item in (a, b) if item.wall_id is not None]
                if opts:
                    conflicts.append({'k': key[0], 'v': v, 'options': opts})
        for vertex, crossings in offset_corners.items():
            # Treat adjacent layers as a single corner. Stopping both layers
            # on one axis avoids cutting a gap between four crossing modules.
            fixed_axes = {item.length_axis for pair in crossings for item, _ in pair
                          if item.wall_id is None}
            cut_axis = 1 if 0 in fixed_axes else 0
            for pair in crossings:
                movable = [(item, bounds) for item, bounds in pair if item.wall_id is not None]
                if not movable:
                    continue
                item, bounds = next((part for part in movable if part[0].length_axis == cut_axis), movable[0])
                wid, end, amount = item.cut_at(vertex, corner_cut(item.start, item.end, vertex, bounds))
                cuts = walls[wid]['cuts']
                cuts[end] = max(cuts.get(end, 0), amount)
    m = Matcher(conflicts)
    for ci in m.solve():
        c = conflicts[ci]
        report['warnings'].append(f"L{c['k']} vertex {c['v']}: no wall left to shorten (possible Z-fighting)")
    for wid, ci in m.owner.items():
        end, amount = next((end, amount) for w_, end, amount in conflicts[ci]['options'] if w_ == wid)
        walls[wid]['cuts'][end] = amount

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
        offset = unreal.Vector(0, 0, 0)
        if w['inset']:
            dx, dy = SIDES[w['side']][2]
            offset = unreal.Vector(-dx * w['inset'], -dy * w['inset'], 0)
        cuts = w['cuts']
        if len(cuts) == 2:
            start, end = w['start'], w['end']
            direction = unreal.Vector(end[0] - start[0], end[1] - start[1], 0)
            scale = unreal.Vector((CELL - cuts['start'] - cuts['end']) / CELL, 1, 1)
            loc = world(w['k'], start) + offset + direction * cuts['start']
            spawn(wall_cls, loc, w['yaw'], scale, 'Corner', label, w['k'])
            report['corners'] += 1
        elif cuts:
            end, amount = next(iter(cuts.items()))
            corner_cls = None
            if amount == WALL_THICKNESS:
                corner_cls = prop(w['room'], 'CornerClass') or family_corner(wall_cls)
            length_scale = 1.0
            if corner_cls is None and (w['shared'] or amount != WALL_THICKNESS):
                # Keep the same finish for a nonstandard cut, or when the
                # selected wall family has no matching corner.
                corner_cls = wall_cls
                length_scale = (CELL - amount) / CELL
            elif corner_cls is None:
                corner_cls = prop(builder, 'CornerClass')
            if corner_cls is None:
                report['warnings'].append(f'{label}: no corner Blueprint for {wall_cls.get_name()}')
                corner_cls = wall_cls
            # Mirror about the end pivot to shorten from the start (Basement convention).
            mirrored = end == 'start'
            pivot = w['end'] if mirrored else w['start']
            scale_x = -length_scale if mirrored else length_scale
            scale = unreal.Vector(scale_x, 1, 1) if scale_x != 1 else None
            spawn(corner_cls, world(w['k'], pivot) + offset, w['yaw'], scale, 'Corner', label, w['k'])
            report['corners'] += 1
        else:
            spawn(wall_cls, world(w['k'], w['start']) + offset, w['yaw'], None, 'Wall', label, w['k'])
            report['walls'] += 1

    def light_room(stack):
        """Highest-priority covering room that sets its own lights, else the base (lowest) room.
        A rug/priority patch without light settings keeps the surrounding room's light pattern."""
        stack = sorted(stack, key=lambda room: room.rank, reverse=True)
        for room in stack:
            r = room.actor
            own_x = prop(r, 'LightSpacingX', -1)
            own_y = prop(r, 'LightSpacingY', -1)
            own_class = prop(r, 'CeilingLightClass')
            if (own_x is not None and own_x >= 0) or (own_y is not None and own_y >= 0) or own_class:
                return room
        return stack[-1]

    def on_axis(n, lo, hi, step):
        """Every `step` cells along one axis, centred in the room; a room narrower than the
        step (e.g. a 1-cell corridor across its width) gets its centre row."""
        if not step or step <= 0:
            return False
        size = hi - lo
        return (n - lo - ((size - 1) % step) // 2) % step == 0

    for (k, i, j), room in sorted(cells.items()):
        # A continuous open volume has no slab between its own 4 m bands.
        # An enclosed volume supplies its own surfaces, including any shared slab.
        stack = (room,) if room.enclosed else cover[(k, i, j)]
        st = Settings(builder, room.actor)
        key = f'{seed}:{k}:{i}:{j}'
        if all(r.bottom == k for r in stack):
            floor_cls = pick(st.get('FloorClasses'), key + ':floor')
            if floor_cls:
                spawn(floor_cls, world(k, (i, j)), 0.0, None, 'Floor', f'{i}_{j}', k)
                report['floors'] += 1
        if any(r.top > k + 1 for r in stack):
            continue
        lr = light_room(stack)
        lst = Settings(builder, lr.actor)
        x0, y0, x1, y1 = lr.rect
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
