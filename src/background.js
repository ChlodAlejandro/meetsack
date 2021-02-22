if (window.gm_members == null)
    window.gm_members = {};
var check = () => {
    const now = Math.floor(Date.now() / 1000);
    const curList = [];
    document.querySelectorAll(".ZjFb7c").forEach(e => {
        curList.push(e.innerText);

        if (window.gm_members[e.innerText] == null)
            window.gm_members[e.innerText] = { start: now, lastPing: now, pings: [] }

        window.gm_members[e.innerText].lastPing = now;
        window.gm_members[e.innerText].pings.push(true);
    });

    for (const member of Object.values(window.gm_members)) {
        if (member.lastPing !== now) {
            member.lastPing = now;
            member.pings.push(false);
        }
    }

    setTimeout(check, 1000);
};
check();

// Export member list as an array
console.log(Object.entries(window.gm_members).map(([k, v]) => {
    return v.pings.reduce((p, n) => p || n, true) ? k : null
}).filter(v => v !== null));

// Export data for Meetsack processor
navigator.clipboard.writeText(JSON.stringify(window.gm_members)).then(function() {
    alert("copied!");
});