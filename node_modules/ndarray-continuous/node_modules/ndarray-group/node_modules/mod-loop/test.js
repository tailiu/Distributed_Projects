var test = require('tape')
  , mod = require('./')

test('Works as expected', function(t) {
  t.equal(mod(5,  10), 5)
  t.equal(mod(10, 10), 0)
  t.equal(mod(15, 10), 5)

  t.equal(mod(-5, 10), 5)
  t.equal(mod(-2, 10), 8)
  t.equal(mod(-8, 10), 2)
  t.equal(mod(-10, 10), 0)

  t.equal(mod(5, 25),  5)
  t.equal(mod(25, 25), 0)
  t.equal(mod(35, 25), 10)

  t.equal(mod(-5, 25), 20)
  t.equal(mod(-2, 25), 23)
  t.equal(mod(-8, 25), 17)
  t.equal(mod(-500, 25), 0)

  t.end()
})
