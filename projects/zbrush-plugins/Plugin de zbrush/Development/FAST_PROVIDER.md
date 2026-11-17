# Fast camera provider for Render Capture and ID

Render Capture and both ID actions read the standalone Camera Bank Fast bank, FB25Data. Fast 0.3 imports native VWS views with Render ON and can set the Render flag for every stored camera at once. Both consumers use these flags through the existing v9 reader contract.

Development/build_fast_reader.py extracts the dependency closure of Fast's read-only recall/visibility routines. It includes only referenced globals and excludes camera controls, bank factories, renaming, store/update and writer recovery. The adapter shares Fast's FBFCache binding so a warm distinct-ID model does not need a new full name traversal per camera or consumer. Read scratch memory and variables are private to each consumer.

A pending Fast light or full writer transaction blocks preflight. Only a Fast camera action may recover that transaction. Manual-only legacy review remains the existing Fast contract.

ID recovery records provider 325 and the originating Fast bank nonce. A previous-provider pending record is retained and rejected before restoration; a replacement Fast bank does not receive an old active-camera index. Existing RGB/PolyGroups generation, Colorize activation, matching-output replacement and PNG validation are preserved.

The default installer component is RenderID. Fast is installed separately. All/Both select both consumers; there is no Camera component. Old writer files are retired with verified backups. Fast data stays v9, 123,088 bytes.

The included fast_camera_reference.txt is a matching build reference. Builders prefer the adjacent standalone source, and use that reference when rebuilding an extracted consumer package without the sibling source folder.
