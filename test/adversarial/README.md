# Adversarial Tests

This directory contains a single script (pwn.js) which alerts the user that
their box has been pwned.

It also contains a variety of files which attempt XSS attacks by injecting
script tags through the various sources of input to the DOM.

To compensate for these, MicrobeTrace scrubs all inputs of anything matching a
set of dumb regexes that browsers will interpret as tags. Accordingly, any files
which contain tag-like syntax (e.g. a CSV with a field populated by HTML or XML
values) will not be loaded completely and correctly.
THIS IS A FEATURE, NOT A BUG.

To test MicrobeTrace's security using these files, launch a webserver on port
8080 in the MicrobeTrace Root directory. Then, with the server running, launch
MicrobeTrace and load any of the files in this directory. If you recieve an
alert that your username has been pwned, it means that somewhere in the program,
an unsanitized user input has been leaked into the DOM. This is a security bug.
Please contact nsp3@cdc.gov with a description of how you got the message (which
file you were using and what part of the program you were interacting with).
Please do NOT post this as an issue on Github.

Thank you!
