# Development Notes

This is just a simple log of ideas concerning the general direction of the progress of this project. I'm keeping this to improve my working memory of the odd engineering choices I'm making. The choices are predominantly the effects of attempting to adapt the codebase of a large, complex project (~5000 lines of maintained code) to a completely different platform.

## 2018-02-22

I started this a few weeks ago, but today was the first time I was able to devote enough development attention to get the thing sort-of working in-browser. I'm hoping to present this as a 0.3.x branch of the project. However, before I can do that, it must demonstrate a base level of functionality:

* It must continue to work offline.
* It must be compatible with Internet Explorer 10, and preferably 9 (and this is a big problem).
* There must be a way to "install" it.
* And it must replicate as much of MicrobeTrace's functionality as possible.

Every call to electron must either be eliminated or replaced. Some of these are obvious (instead of calling `electron.ipcRenderer.send('launch-view', 'table.html')` or whatever, just set the href of the anchor tags to the path of the view). Some are less so (replacing the compute windows with web workers?).

Here's what works:

* Parsing FASTA.
* Using application cache to enable offline use.

Here's what half-works:

* Rendering the network - The nodes work and the physics of the links are there, but the x and y attributes of the line tags in the SVG aren't getting set, which is a problem!

Here's what's definitely broken:

* Everything else.

## 2018-02-23

I'm thinking that the views should all be collapsed into the index.html file. Or rather, that the application should be structured in such a way as to launch multiple views in a single window. That way, we won't have to attempt anything inventive with JSON encoded in URLs and appcache workarounds for that horrible stuff. The downside is memory bloating, which I will deal with when it rears its ugly head. In the meanwhile, I've put the views in the components directory, deleted the old data files (the map view would be profoundly broken, if it worked well enough to see that), and started to put imported components directly into index.html and app.js.

Here are some ideas:

* Let's check for online status using [`navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine) (if the browser knows that trick), and [invalidate the appcache](https://stackoverflow.com/questions/11817578/purge-and-update-html5-application-cache-through-javascript) if it's true.
* https://clipboardjs.com/ 'nuff said

In the interest of pushing compatibility back through to IE (ugh), I've integrated html5shiv and core-js. I may also need an SVG solution, like [svg4everybody](https://github.com/jonathantneal/svg4everybody), but I'm definitely getting ahead of myself. These compatibility issues won't be solved until I start testing, and I won't start testing until I have a working proof-of-concept with a reasonable degree of feature-completeness.
