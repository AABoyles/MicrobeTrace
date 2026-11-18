# Security Tests

This directory contains a single script (pwn.js) which alerts the user that
their box has been pwned.

It also contains a variety of files which attempt XSS attacks by injecting
script tags through the various sources of input to the DOM.

To compensate for these, MicrobeTrace scrubs all inputs of anything matching a
set of dumb regexes that browsers will interpret as tags. Accordingly, any files
which contain tag-like syntax (e.g. a CSV with a field populated by HTML or XML
values) will not be loaded completely and correctly.
THIS IS A FEATURE, NOT A BUG.

Script tags inserted through `innerHTML` never run, so those files only catch
leaks into markup that is parsed some other way. `sessionInjection.microbetrace`
(a session, via File > Open) and `hivtraceInjection.json` (HIV-TRACE output)
use `<img src=x onerror=...>`, which does run through `innerHTML`, in field
names, values, node IDs and (in the session) a color. Unlike CSV and Excel
files, sessions and HIV-TRACE/GHOST output aren't escaped as they load, so
every place their names and values are shown has to treat them as text (#204).
Since #218 no loader escapes what it reads: values are stored as loaded and
escaped (or set as text) where they are shown. `test/e2e/injection.spec.js`
loads every file here, opens the views that show IDs, names and values, and
fails if a script runs, a request is made or an element appears.
`test/unit/menus.test.js` loads the session and HIV-TRACE files through
MicrobeTrace's loaders.

To test MicrobeTrace's security using these files, launch the MicrobeTrace
webserver:

```sh
npm start
```

Then, with the server running, [launch MicrobeTrace](http://localhost:5000) and
load any of the files in this directory. If you recieve an alert that
"ya been pwned", it means that somewhere in the program, an unsanitized user
input has been leaked into the DOM. This is a security bug.
Please report it as described in [SECURITY.md](../../SECURITY.md), with a description of how you got the
message (which file you were using and what part of the program you were
interacting with). Please do NOT post this as an issue on Github.

Thank you!
