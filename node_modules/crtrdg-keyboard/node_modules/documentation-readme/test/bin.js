var fs = require('fs-extra')
var path = require('path')
var execFile = require('child_process').execFile
var test = require('tap').test
var tmp = require('tmp')

tmp.setGracefulCleanup()
var bin = path.join(__dirname, '../bin/documentation-readme')
var fixtures = path.join(__dirname, 'fixture')
var sourceFile = path.join(fixtures, 'index.js')

// Check any file in fixtures/ with something.blah.md, expecting output to equal
// contents of something.expected.md
var tests = fs.readdirSync(fixtures)
  .filter(function (f) {
    return /md$/.test(f) && !/expected\.md/.test(f);
  })
  .forEach(function (f) {
    test(f, testInputFile.bind(null, f))
  });

function testInputFile(f, t) {
  var expectedFile = path.join(fixtures, f.replace(/[^.]*\.md/, 'expected.md'))
  var expected = fs.readFileSync(expectedFile, 'utf-8')
  tmp.file({postfix: '.md'}, function (err, readmeFile) {
    t.error(err)
    fs.copy(path.join(fixtures, f), readmeFile, function (err) {
      t.error(err)
      execFile(bin, [readmeFile, '-s', 'API', '--', sourceFile], function (err) {
        var content = fs.readFileSync(readmeFile, 'utf-8')
        t.error(err)
        t.equal(content, expected)
        t.end()
      })
    })
  })
}

test('defaults to README.md', function (t) {
  var expectedFile = path.join(fixtures, 'middle.expected.md')
  var expected = fs.readFileSync(expectedFile, 'utf-8')
  tmp.dir({unsafeCleanup: true}, function (err, d) {
    t.error(err)
    var readmeFile = path.join(d, 'README.md')
    fs.copy(path.join(fixtures, 'middle.update.md'), readmeFile, function (err) {
      t.error(err)
      execFile(bin, ['-s', 'API', '--', sourceFile], {cwd: d}, function (err) {
        var content = fs.readFileSync(readmeFile, 'utf-8')
        t.error(err)
        t.equal(content, expected)
        t.end()
      })
    })
  })
})

test('forwards arguments to main documentation module', function (t) {
  var expectedFile = path.join(fixtures, 'config.expected.md')
  var expected = fs.readFileSync(expectedFile, 'utf-8')
  tmp.file({postfix: '.md'}, function (err, readmeFile) {
    t.error(err)
    fs.copy(path.join(fixtures, 'middle.update.md'), readmeFile, function (err) {
      t.error(err)
      execFile(bin, [
        readmeFile, '-s', 'API',
        '--',
        sourceFile, '-c',
        path.join(fixtures, 'config.json')
      ], function (err) {
        t.error(err)
        var content = fs.readFileSync(readmeFile, 'utf-8')
        t.equal(content, expected)
        t.end()
      })
    })
  })
})

test('requires -s option', function (t) {
  var expectedFile = path.join(fixtures, 'middle.expected.md')
  var expected = fs.readFileSync(expectedFile, 'utf-8')
  tmp.dir({unsafeCleanup: true}, function (err, d) {
    t.error(err)
    var readmeFile = path.join(d, 'README.md')
    fs.copy(path.join(fixtures, 'middle.update.md'), readmeFile, function (err) {
      t.error(err)
      execFile(bin, [readmeFile, '--', sourceFile], {cwd: d}, function (err, stdout, stderr) {
        t.ok(err.code !== 0)
        t.match(stderr, 'Missing required argument: s')
        t.end()
      })
    })
  })
})

test('--compare exits nonzero when changes are needed', function (t) {
  var expectedFile = path.join(fixtures, 'middle.expected.md')
  var expected = fs.readFileSync(expectedFile, 'utf-8')
  tmp.dir({unsafeCleanup: true}, function (err, d) {
    t.error(err)
    var readmeFile = path.join(d, 'README.md')
    fs.copy(path.join(fixtures, 'middle.update.md'), readmeFile, function (err) {
      t.error(err)
      execFile(bin, ['-s', 'API', '-c', '--', sourceFile], {cwd: d}, function (err, stdout, stderr) {
        t.ok(err)
        t.notEqual(err.code, 0)
        t.end()
      })
    })
  })
})

test('--compare exits zero when changes are NOT needed', function (t) {
  var expectedFile = path.join(fixtures, 'middle.expected.md')
  var expected = fs.readFileSync(expectedFile, 'utf-8')
  tmp.dir({unsafeCleanup: true}, function (err, d) {
    t.error(err)
    var readmeFile = path.join(d, 'README.md')
    fs.copy(path.join(fixtures, 'middle.expected.md'), readmeFile, function (err) {
      t.error(err)
      execFile(bin, ['-s', 'API', '-c', '--', sourceFile], {cwd: d}, function (err, stdout, stderr) {
        t.error(err)
        t.end()
      })
    })
  })
})
