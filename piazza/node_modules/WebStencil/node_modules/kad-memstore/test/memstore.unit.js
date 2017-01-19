'use strict';

var expect = require('chai').expect;
var KadMemStore = require('..');

describe('KadMemStore', function() {

  describe('@constructor', function() {

    it('should create an instance without the new keyword', function() {
      expect(KadMemStore()).to.be.instanceOf(KadMemStore);
    });

    it('should create an instance with the new keyword', function() {
      expect(new KadMemStore()).to.be.instanceOf(KadMemStore);
    });

  });

  describe('#get', function() {

    it('should return the value at _store[key]', function(done) {
      var store = new KadMemStore();
      store._store.beep = JSON.stringify({
        key: 'beep',
        value: 'boop',
        publisher: 'c9ddf842c1acb00c2660f47922da1428e49eb843',
        timestamp: Date.now()
      });
      store.get('beep', function(err, value) {
        expect(value).to.equal(store._store.beep);
        done();
      });
    });

    it('should return null if no item at key', function(done) {
      var store = new KadMemStore();
      store.get('beep', function(err, value) {
        expect(value).to.equal(null);
        done();
      });
    });

  });

  describe('#put', function() {

    it('should put the value at _store[key]', function(done) {
      var store = new KadMemStore();
      var item = JSON.stringify({
        key: 'beep',
        value: 'boop',
        publisher: 'c9ddf842c1acb00c2660f47922da1428e49eb843',
        timestamp: Date.now()
      });
      store.put('beep', item, function(err) {
        expect(store._store.beep).to.equal(item);
        done();
      });
    });

  });

  describe('#del', function() {

    it('should delete the value at _store[key]', function(done) {
      var store = new KadMemStore();
      store._store.beep = JSON.stringify({
        key: 'beep',
        value: 'boop',
        publisher: 'c9ddf842c1acb00c2660f47922da1428e49eb843',
        timestamp: Date.now()
      });
      store.del('beep', function(err) {
        expect(store._store.beep).to.equal(undefined);
        done();
      });
    });

  });

  describe('#createReadStream', function() {

    it('should stream the keys in the proper format then end', function(done) {
      var store = new KadMemStore();

      function createItem(key, value) {
        return JSON.stringify({
          key: key,
          value: value,
          publisher: 'c9ddf842c1acb00c2660f47922da1428e49eb843',
          timestamp: Date.now()
        });
      }

      store._store = {
        one: createItem('one', '1'),
        two: createItem('two', '2'),
        three: createItem('three', '3'),
        four: createItem('four', '4'),
        five: createItem('five', '5'),
        six: createItem('six', '6'),
        seven: createItem('seven', '7'),
        eight: createItem('eight', '8'),
        nine: createItem('nine', '9'),
        ten: createItem('ten', '10')
      };

      var stream = store.createReadStream();

      stream.on('data', function(data) {
        expect(typeof data.key).to.equal('string');
        expect(typeof data.value).to.equal('string');
        expect(Object.keys(JSON.parse(data.value)).length).to.equal(4);
        store.del(data.key, function(err) {
          expect(err).to.equal(undefined);
        });
      }).on('end', function() {
        expect(Object.keys(store._store).length).to.equal(0);
        done();
      });
    });

  });

});
