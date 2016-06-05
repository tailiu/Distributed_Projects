# documentation-readme

[![Circle CI](https://circleci.com/gh/documentationjs/documentation-readme.svg?style=svg)](https://circleci.com/gh/documentationjs/documentation-readme) [![npm version](https://badge.fury.io/js/documentation-readme.svg)](http://badge.fury.io/js/documentation-readme)

Inject [documentationjs](http://documentation.js.org/)-generated documentation into your README.md.

## Usage

### Command line

```sh
npm install -g documentation-readme
cd /your/project
documentation-readme README.md -s "API Usage" -- [documentationjs opts]
```

This will look for a section in README.md with a heading like `## API Usage`.
(The heading can be any level.)  The content under that heading will be replaced
with output of documentationjs using any arguments you specified:
`documentation -f md [documentationjs opts]`.

Other options:

```
Usage: bin/documentation-readme documentation [file=README.md] --section "API" [--compare-only] [--] [documentationjs options]

Options:
  -s, --section       The section heading after which to inject generated documentation   [required]
  -c, --compare-only  Instead of updating the given README with the generated documentation, just
                      check if its contents match, exiting nonzero if not.          [default: false]
  -q, --quiet         Quiet mode: do not print messages or README diff to stdout.   [default: false]
  -h, --help          Show help                                                            [boolean]
  --version           Show version number                                                  [boolean]
```

### npm script

    cd /your/project
    npm install --save-dev documentation-readme

And then add to your `package.json`:

```javascript
{
  // ... other scripts
  "docs": "documentation-readme -s \"API Usage\""
}
```

### mdast plugin

#### plugin

An mdast plugin to inject the output of documentationjs at a certain
heading in a markdown file.


**Parameters**

-   `mdast`  

-   `opts`  



**Examples**

```javascript
var docjsReadme = require('documentation-readme/lib/plugin')
mdast.use(docjsReadme, {
 section: 'usage', // inject into the ## Usage section of the input doc
 documentationArgs: [ '--shallow', '/path/to/entry.js' ]
}).process(inputMarkdownContent, function(err, vfile, content) {
 console.log(content)
})
```




## [Contributing](CONTRIBUTING.md)

documentation is an OPEN Open Source Project. This means that:

Individuals making significant and valuable contributions are given
commit-access to the project to contribute as they see fit. This
project is more like an open wiki than a standard guarded open source project.
