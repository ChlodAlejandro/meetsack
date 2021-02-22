/**
 * Meetsack Data Processor
 *
 * Responsible for getting the output of the Meetsack browser
 * extension and processing it into a log HTML and PDF file,
 * and a timeline.
 *
 * No effort was made to properly style the code for this project.
 * It was intended for personal use only.
 *
 * @author Chlod Alejandro
 */
import cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import htmlToPdf from "html-pdf-node";
import * as settings from "./settings";

class Log {

    static html = (() : cheerio.Root => {
        const root = cheerio.load("<table id=\"log\" style=\"border: 1px solid black; border-collapse: collapse;\"></table>");

        const style = root("<style>");
        style.html("body { font-family: sans-serif; } table, tr { width: 100% } td { settings.padding: 4px; } @media print { footer { page-break-after: always; }" +
            "}");

        root("head").append(style);
        root("#log").before(
            root("<div>")
                .attr({
                    style: "text-align: center;"
                })
                .append(
                    root("<h1>")
                        .text("Meeting Attendance Log")
                )
        );
        root("body").append(
            root("<div>")
                .attr({
                    style: "width:100%;text-align:right;font-size:smaller;white-space:pre-line;"
                })
                .text(`\nAutomatically generated by Meetsack on ${
                    new Date().toLocaleString()
                }\nMeetsack is available under the Apache License 2.0 \u00a9 Chlod Alejandro\n`)
                .append(
                    root("<a>")
                        .attr({
                            href: "https://github.com/ChlodAlejandro/meetsack"
                        })
                        .text("https://github.com/ChlodAlejandro/meetsack")
                )
        );
        return root;
    })();
    static row = 0;

    static addRow(date : Date, text : string) {
        const table = this.html("#log");

        if (Log.row++ == 0) {
            const header = this.html("<td>");
            header.attr("colspan", "999");
            header.attr("style", "text-align: center; font-weight: bold; border: 1px solid black; background-color: lightgray; @media print { #log { border:solid #000 !important; border-width:1px !important; } .dat, tr { border:solid #000 !important; border-width:0 1px 1px 0 !important; } }");

            header.text(`== ${date.toLocaleString()} ==`);

            table.append(this.html("<tr>").append(header));
        }

        const time = this.html("<td class=\"tim\">");
        time.attr("style", "border-right: 1px solid gray; white-space: nowrap;");
        time.text(date.toLocaleString());

        const data = this.html("<td class=\"dat\">");
        data.attr("style", "min-width: 100%")
        data.text(text);

        const row = this.html("<tr>");
        row.attr("style", `background-color: ${
            Log.row % 2 == 1 ? "white" : "lightgray"
        }`);

        row.append(time);
        row.append(data);

        table.append(row);
    }

    static addPage(content : cheerio.Cheerio, footerContent? : cheerio.Cheerio) {
        this.html("body")
            .append(
                this.html("<footer>")
                    .append(footerContent ?? this.html("<hr>"))
            )
            .append(
                content
            );
    }

    static render() : string { return Log.html.html(); }

}

interface Attendant {
    start: number;
    lastPing: number;
    pings: boolean[];

    ranges: { start: number; end: number; active: boolean; }[]
}

(async () => {
    // Calculate from file
    const inFile = path.resolve(process.argv[2] ?? path.join(process.cwd(), "attendance.json"));
    const attendance : { [key: string]: Attendant } = JSON.parse(fs.readFileSync(inFile).toString("utf8"));

    let earliest = null;
    let latest = null;
    for (const [name, attendant] of Object.entries(attendance)) {
        if (attendant.start < settings.cutoff) {
            const pings = settings.cutoff - attendant.start;
            console.warn(`${name} has ${pings} pings before the cutoff time. Trimming...`);

            attendant.pings = attendant.pings.slice(pings);
            attendant.start = settings.cutoff;
        }

        if (earliest == null || earliest > attendant.start)
            earliest = attendant.start;
        if (latest == null || latest < attendant.lastPing)
            latest = attendant.lastPing;


        attendant.ranges = [];

        let rangeStart = attendant.start;
        let rangeCurrent = attendant.start;
        let rangeState = true;
        for (const ping of attendant.pings) {
            if (ping !== rangeState) {
                attendant.ranges.push({
                    start: rangeStart,
                    end: rangeCurrent,
                    active: rangeState
                });
                rangeStart = rangeCurrent + 1;
                rangeState = !rangeState;
            }

            rangeCurrent++;
        }
        attendant.ranges.push({
            start: rangeStart,
            end: rangeCurrent,
            active: rangeState
        });
    }

    for (const rangeDef of Object.entries(attendance).reduce((p, [name, attendant]) => {
        for (const range of attendant.ranges) {
            p.push({
                name: name,
                range: range
            });
        }
        return p;
    }, <{name: string, range: Attendant["ranges"][number]}[]>[]).sort((a, b) => {
        return a.range.start - b.range.start;
    })) {
        if (rangeDef.range.start === earliest)
            Log.addRow(new Date(rangeDef.range.start * 1000), `${rangeDef.name} is in the meeting.`);
        else if (rangeDef.range.active)
            Log.addRow(new Date(rangeDef.range.start * 1000), `${rangeDef.name} joined the meeting.`);
        else
            Log.addRow(new Date(rangeDef.range.start * 1000), `${rangeDef.name} left the meeting.`);
    }

    const s = cheerio.load("<svg id=\"timeline\">", {
        xmlMode: true
    });
    const svg = s("#timeline");

    const attendants = Object.keys(attendance).length;
    const timelineSize = latest - earliest;

    const xPreTimeline = settings.paddingLeft + settings.nameColumnSize + settings.nameRightMargin;
    const yTimeline = (settings.nameSize * attendants) + (settings.nameSpacing * (attendants - 1));

    const width =
        xPreTimeline + (timelineSize * settings.secondScale) + settings.paddingRight;
    const height =
        settings.paddingTop + yTimeline + settings.paddingBottom;

    svg.attr({
        width: width,
        height: height + settings.timelineSplitBottomSpace,
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: `0 0 ${width} ${height + settings.timelineSplitBottomSpace}`
    });

    svg.append(
        s("<defs>")
            .append(
                s("<style>")
                    .text("* { font-family: sans-serif; }")
            )
    );

    let splits : {x: number, label: string}[] = [];
    splits.push({x: 0, label: new Date(earliest * 1000).toLocaleTimeString()});
    for (let i = 0; i < timelineSize; i++) {
        if (
            (new Date((earliest + i) * 1000).getTime() / 1000) % settings.timelineSplitInterval == 0
            && Object.values(splits).find(v => v.x === i) == null
        )
            splits.push({x: i, label: new Date((earliest + i) * 1000).toLocaleTimeString()});
    }
    if (timelineSize - splits[splits.length - 1].x > settings.timelineSplitInterval / 2)
        splits.push({x: timelineSize, label: new Date(latest * 1000).toLocaleTimeString()});

    for (const split of splits) {
        svg.append(
            s("<line>").attr({
                x1: xPreTimeline + (split.x * settings.secondScale),
                y1: settings.paddingTop / 2,
                x2: xPreTimeline + (split.x * settings.secondScale),
                y2: height - settings.paddingBottom / 2,
                style: "stroke:rgb(64,64,64);stroke-width:0.5"
            })
        );
        svg.append(
            s("<text>")
                .attr({
                    fill: "black",
                    transform: `translate(${xPreTimeline + (split.x * settings.secondScale) + 5} ${height + settings.timelineSplitBottomSpace / 1.5}) rotate(-90)`,
                    "font-size": settings.timelineSplitLabelSize
                })
                .text(split.label)
                // .append(
                //     s("<tspan>")
                //         .attr({
                //             transform: "rotate(90)"
                //         })
                // )
        )
    }

    let index = 0;
    for (const [name, attendant] of Object.entries(attendance)) {
        const topOffset = index * (settings.nameSize + settings.nameSpacing);
        svg.append(
            s("<text>")
                .attr({
                    x: settings.paddingLeft,
                    y: settings.paddingTop + topOffset,
                    "font-size": settings.nameSize
                })
                .text(name)
        );

        for (const range of attendant.ranges) {
            if (range.active) {
                svg.append(
                    s("<rect>")
                        .attr({
                            x: xPreTimeline + ((range.start - earliest) * settings.secondScale),
                            y: settings.paddingTop + topOffset - 12,
                            height: settings.nameSize,
                            width: ((range.end - range.start) * settings.secondScale),
                            style: "fill:#77ff77"
                        })
                )
            }
        }

        svg.append(
            s("<text>")
                .attr({
                    x: xPreTimeline + (timelineSize * settings.secondScale) + 15,
                    y: settings.paddingTop + topOffset,
                    "font-size": settings.nameSize
                })
                .text(`${(attendant.ranges.reduce(
                    (p, n) => p + (n.active ? (n.end - n.start) : 0),
                    0
                ) / 60).toFixed(1)} m`)
        );

        index++;
    }

    fs.writeFileSync(path.resolve(process.cwd(), "timeline.svg"), s.xml());

    htmlToPdf.generatePdf({ content: Log.render() }, {
        format: "A4",
        printBackground: true,
        margin: {
            top: 32,
            right: 32,
            bottom: 32,
            left: 32
        }
    }).then(pdfBuffer => {
        fs.writeFileSync(path.resolve(process.cwd(), "log.pdf"), pdfBuffer);
    });

    htmlToPdf.generatePdf({ content: (() : cheerio.Root => {
        const x = cheerio.load("");
        x("body").append(
            x("<h1>").text("Meeting Attendance Timeline")
        );
        x("body").append(s.xml());
        x("body").append(
            x("<div>")
                .attr({
                    style: "width:100%;text-align:right;font-size:smaller;white-space:pre-line;"
                })
                .text(`\nAutomatically generated by Meetsack on ${
                    new Date().toLocaleString()
                }\nMeetsack is available under the Apache License 2.0 \u00a9 Chlod Alejandro\n`)
                .append(
                    x("<a>")
                        .attr({
                            href: "https://github.com/ChlodAlejandro/meetsack"
                        })
                        .text("https://github.com/ChlodAlejandro/meetsack")
                )
        );
        return x;
    })().html() }, {
        format: "A4",
        printBackground: true,
        margin: {
            top: 32,
            right: 32,
            bottom: 32,
            left: 32
        },
        landscape: true
    }).then(pdfBuffer => {
        fs.writeFileSync(path.resolve(process.cwd(), "timeline.pdf"), pdfBuffer);
    });
})();