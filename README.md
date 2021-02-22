# Meetsack
Meant of personal use only. If you do get it running though, congrats.

## Installation
You are required to have Node version >13 and npm (which comes bundled with node). Obviously, you also need Git.

1. Clone the repo.
```shell
git clone https://github.com/ChlodAlejandro/meetsack.git
```
2. Install required dependencies.
```shell
npm install
```
3. Join a [Google Meet](https://meet.google.com)
4. Keep the Chat/Participants window open. Closing this window will cause all users to render as absent.
5. Run the beginning section of `src/background.js` to continuously check for attendee updates. Use your browser's developer console for this.
6. Data is stored in the `gm_members` global. For use with the processor, use the provided clipboard copy script.
7. Save the copied data (which should be in JSON format) to `attendance.json`.
8. Optionally configure settings in `src/settings.ts` - namely the cutoff time. 
9. Run the processor.
```shell
npm run start
```
10. Done!

By the end of it, there should be two PDFs, an SVG, and an HTML file.
```
timeline.svg    A timeline of all attendees.
timeline.pdf    Same as above but in PDf format.
log.html        A full list of attendant joins and leaves.
log.pdf         Same as above but in PDF format.
```

## License
Apache License 2.0. Go crazy.

## Maintenance
None. Maybe eventually. I crammed this, so don't expect much.