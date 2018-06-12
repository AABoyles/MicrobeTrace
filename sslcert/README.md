# DO NOT USE THIS DIRECTORY FOR SSL/TLS CERTIFICATE MANAGEMENT ON PRODUCTION ENVIRONMENTS

This directory is designed to hold self-signed certificates for developing using
browser features that are only available to resources served over SSL/TLS.
Specifically, this includes the client-side caching system that MicrobeTrace
uses ([Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)).

MicrobeTrace, its developers, and the CDC cannot and will not be held responsible
for any catastrophes you manage to cause by poor encryption management practices.
If you are interested in doing this properly, you can [deploy MicrobeTrace](https://github.com/AABoyles/WebMicrobeTrace/wiki/Deployment)
to a cloud that manages its own domain's SSL certificates (which is any of them),
or you can set up your own encryption _correctly_ using [LetsEncrypt](https://letsencrypt.org/).

Once again, this directory is for DEV only. Just ignore (or delete) this directory
in PROD. If you use it in PROD, bad things will happen and _it will be your fault_.
You have been warned.
