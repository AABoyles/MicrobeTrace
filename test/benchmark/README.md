# Benchmark Tests

This is where we're developing MicrobeTrace's benchmark tests.

## run.js

The core benchmark test is `run.js`, which executes MicrobeTrace sessions over a
range between 100 and 3200 sequences large. 3200 is just large enough that we
should (currently) expect it to fail. If we can expand MicrobeTrace's compute
capacity (or otherwise speed it up) then we may increase this upper range in the
future.

To run the benchmark, type this into your terminal:

```sh
nodejs tests/benchmark/run.js
```

At present it starts the server, but it doesn't shut it down (or shut itself down),
so once you've got your data, hit `Ctrl-C` to end it.
