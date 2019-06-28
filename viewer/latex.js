const embedded = window.parent !== window
let query = document.location.search.substring(1);
const parts = query.split('&');
let server = undefined;
let file;
for (var i = 0, ii = parts.length; i < ii; ++i) {
    let param = parts[i].split('=');
    if (param[0].toLowerCase() == "server")
        server = param[1];
    if (param[0].toLowerCase() == "file")
        file = decodeURIComponent(param[1]);
}
if (server === undefined) {
    server = `ws://${window.location.hostname}:${window.location.port}`;
}

//  Set up default prefreneces
PDFViewerApplicationOptions.set('sidebarViewOnLoad',0);
PDFViewerApplicationOptions.set('enableWebGL',true);
PDFViewerApplicationOptions.set('externalLinkTarget',4);
PDFViewerApplicationOptions.set('eventBusDispatchToDOM',true);

let socket = new WebSocket(server);
socket.addEventListener("open", () => socket.send(JSON.stringify({type:"open", path:file})));
socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
        case "synctex":
            // From LaTeX-Workshop
            let container = document.getElementById('viewerContainer')
            const pos = PDFViewerApplication.pdfViewer._pages[data.data.page - 1].viewport.convertToViewportPoint(data.data.x, data.data.y)
            let page = document.getElementsByClassName('page')[data.data.page - 1]
            let scrollX = page.offsetLeft + pos[0]
            let scrollY = page.offsetTop + page.offsetHeight - pos[1]
            container.scrollTop = scrollY - document.body.offsetHeight * 0.4
            let indicator = document.getElementById('synctex-indicator')
            indicator.className = 'show'
            indicator.style.left = `${scrollX}px`
            indicator.style.top = `${scrollY}px`
            setTimeout(() => indicator.className = 'hide', 10)
            break;
        case "refresh":
            socket.send(JSON.stringify({type:"position",
                                        scale:PDFViewerApplication.pdfViewer.currentScaleValue,
                                        scrollTop:document.getElementById('viewerContainer').scrollTop,
                                        scrollLeft:document.getElementById('viewerContainer').scrollLeft}));
            PDFViewerApplication.open(`/pdf:${decodeURIComponent(file)}`);
            break;
        case "position":
            PDFViewerApplication.pdfViewer.currentScaleValue = data.scale;
            document.getElementById('viewerContainer').scrollTop = data.scrollTop;
            document.getElementById('viewerContainer').scrollLeft = data.scrollLeft;
            break;
        default:
            break;
    }
});
socket.onclose = () => {window.close();};

document.addEventListener('pagesinit', (e) => {
    socket.send(JSON.stringify({type:"loaded"}));
});

document.addEventListener('pagerendered', (evt) => {
    const page = evt.detail.pageNumber;
    let canvas_dom = PDFViewerApplication.pdfViewer.getPageView(page - 1).div;
    canvas_dom.onclick = (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        let viewerContainer = null;
        if (PDFViewerApplication.pdfViewer.spreadMode === 0) {
          viewerContainer = canvas_dom.parentNode.parentNode
        } else {
          viewerContainer = canvas_dom.parentNode.parentNode.parentNode
        }
        const left = e.pageX - canvas_dom.offsetLeft + viewerContainer.scrollLeft;
        const top = e.pageY - canvas_dom.offsetTop + viewerContainer.scrollTop - 41;
        const pos = PDFViewerApplication.pdfViewer._pages[page-1].getPagePoint(left, canvas_dom.offsetHeight - top);
        socket.send(JSON.stringify({type:"click", path:file, pos:pos, page:page}));
    };
}, true);

// Open links externally
// identified by target set from PDFJS.LinkTarget.TOP
document.addEventListener('click', (e) => {
    let srcElement = e.srcElement;
    if (srcElement.href !== undefined && srcElement.target == '_top'){
      e.preventDefault();
      socket.send(JSON.stringify({type:"link",href:srcElement.href}));
    }
});
