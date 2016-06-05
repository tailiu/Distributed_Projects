var fs = require('fs')
var test = require('tap').test
var mdast = require('mdast')
var plugin = require('../lib/plugin')

// Check any file in fixtures/ with something.blah.md, expecting output to equal
// contents of something.expected.md
var tests = fs.readdirSync(__dirname + '/fixture')
  .filter(function (f) {
    return /md$/.test(f) && !/expected\.md/.test(f);
  })
  .forEach(function (f) {
    test(f, testInputFile.bind(null, f))
  });

function testInputFile(f, t) {
  var input = fixture(f)
  var expectedFile = f.replace(/[^.]*\.md/, 'expected.md')
  mdast.use(plugin, {
    section: 'API',
    documentationArgs: [__dirname + '/fixture/index.js']
  }).process(input, function (err, file, content) {
    // update expected results. use with caution!
    if (process.env.UPDATE) {
      fs.writeFileSync(__dirname + '/fixture/' + expectedFile, content)
    }
    var expected = fixture(expectedFile)
    t.error(err)
    t.equal(content, expected)
    t.end()
  })
}

function fixture(f) {
  return fs.readFileSync(__dirname + '/fixture/' + f, 'utf-8')
}
