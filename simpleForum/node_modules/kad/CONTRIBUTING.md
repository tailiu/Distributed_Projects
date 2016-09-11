Contributing
============

Want to contribute? Check out our [issue board](http://waffle.io/kadtools/kad)!

This document outlines general patterns and conventions for contributing
to the project. **For in-depth documentation on Kad,
[read the documentation](http://kadtools.github.io).**

Coding Style
------------

Kad adheres to
[Felix's Node.js Style Guide](https://github.com/felixge/node-style-guide).

Conventions
-----------

As you may have noticed, Kad takes a very OOP approach, making use of the
prototype chain to abstract shared behaviors and extend things that are often
different between projects. A good example of this is how
[transports](doc/custom-transports.md) inherit from `RPC`.

You should also make the best use of [JSDoc](http://usejsdoc.org/) comments as
shown throughout the source code.

Test Coverage
-------------

At the time of writing, Kad has complete code coverage (100%) through
it's test suite. It is important to never decrease coverage, so be sure to
include tests for any new code.

You can run the coverage report with:

```
npm run coverage
```

Linting
-------

To help maintain consistent expectations for code quality and enforcing these
conventions, there is an included `.jshintrc` file. Most editors support using
this to alert you of offending code in real time but, if your editor does not,
you can run the linter with:

```
npm run linter
```

Alternatively, the linter will run as part of the test suite as well, which can
be executed with:

```
npm test
```

---

Have fun and be excellent!
