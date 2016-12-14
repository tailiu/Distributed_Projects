'use strict';

var async = require('async');
var expect = require('chai').expect;
var sinon = require('sinon');
var utils = require('../lib/utils');
var constants = require('../lib/constants');
var Item = require('../lib/item');
var AddressPortContact = require('../lib/contacts/address-port-contact');
var KNode = require('../lib/node');
var Logger = require('../lib/logger');
var transports = require('../lib/transports');
var Router = require('../lib/router');
var proxyquire = require('proxyquire');

Router.PING_TTL = 0;

function FakeStorage() {
  this.data = {};
}

FakeStorage.prototype.get = function(key, cb) {
  if (!this.data[key]) {
    return cb(new Error('not found'));
  }
  cb(null, this.data[key]);
};

FakeStorage.prototype.put = function(key, val, cb) {
  this.data[key] = val;
  cb(null, this.data[key]);
};

FakeStorage.prototype.del = function(key, cb) {
  delete this.data[key];
  cb(null);
};

FakeStorage.prototype.createReadStream = function() {

};

describe('Router', function() {

  describe('@constructor', function() {

    it('should create instance without the new keyword', function() {
      expect(Router({ transport: { } })).to.be.instanceOf(Router);
    });

  });

  describe('#_validateKeyValuePair', function() {

    it('should return callback true if no validator defined', function(done) {
      var router = new Router({ transport: { } });
      router._validateKeyValuePair('key', 'value', function(valid) {
        expect(valid).to.equal(true);
        done();
      });
    });

  });

  describe('#_pingContactAtHead', function() {

    it('should replace contact at head with new if ping fails', function() {
      var _rpc = { send: sinon.stub().callsArgWith(2, new Error()) };
      var router = new Router({ transport: _rpc, logger: new Logger(0) });
      var seen = sinon.stub();
      var _bucket = {
        getContact: sinon.stub().returns({ seen: seen }),
        removeContact: sinon.stub(),
        addContact: sinon.stub(),
        indexOf: sinon.stub()
      };
      router._pingContactAtHead({}, _bucket, function() {});
      expect(_bucket.removeContact.called).to.equal(true);
      expect(_bucket.addContact.called).to.equal(true);
      expect(seen.called).to.equal(true);
    });

    it('should callback false if there is no contact at head', function(done) {
      var _rpc = { send: sinon.stub().callsArgWith(2, new Error()) };
      var router = new Router({ transport: _rpc, logger: new Logger(0) });
      var _bucket = {
        getContact: sinon.stub().returns(null)
      };
      router._pingContactAtHead({}, _bucket, function(err, didReplace) {
        expect(didReplace).to.equal(false);
        done();
      });
    });

    it('should callback false if we do not ping the contact', function(done) {
      var _rpc = { send: sinon.stub().callsArgWith(2, new Error()) };
      var router = new Router({ transport: _rpc, logger: new Logger(0) });
      var clock = sinon.useFakeTimers();
      Router.PING_TTL = 3000;
      clock.tick(1000);
      var _bucket = {
        getContact: sinon.stub().returns({ lastSeen: Date.now() })
      };
      clock.tick(2000);
      router._pingContactAtHead({}, _bucket, function(err, didReplace) {
        clock.restore();
        Router.PING_TTL = 0;
        expect(didReplace).to.equal(false);
        done();
      });
    });
  });

  describe('#findNode', function() {

    it('should add all results to routing table if aggressive', function(done) {
      var _rpc = {
        send: sinon.stub().callsArgWith(2, new Error()),
        _contact: new AddressPortContact({ address: '0.0.0.0', port: 1234 })
      };
      var router = new Router({
        transport: _rpc,
        logger: new Logger(0)
      });
      sinon.stub(router, 'lookup').callsArgWith(2, null, 'NODE', [
        {
          address: '0.0.0.0',
          port: 1235
        },
        {
          address: '0.0.0.0',
          port: 1236
        },
        {
          address: '0.0.0.0',
          port: 1237
        },
        {
          address: '0.0.0.0',
          port: 1238
        }
      ]);
      var _updateContact = sinon.stub(router, 'updateContact');
      router.findNode('nodeid', {
        aggressiveCache: true
      }, function() {
        expect(_updateContact.callCount).to.equal(4);
        done();
      });
    });

  });

  describe('#findValue', function() {

    it('should callback with an error if no value is found', function(done) {
      var node = KNode({
        transport: transports.UDP(AddressPortContact({
          address: '0.0.0.0',
          port: 65528
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var _find = sinon.stub(node._router, 'lookup', function(k, t, cb) {
        cb(new Error(), 'NODE');
      });
      node._router.findValue('beep', function(err) {
        expect(err.message).to.equal('Failed to find value for key: beep');
        _find.restore();
        done();
      });
    });

  });

  describe('#_iterativeFind', function() {

    it('should error if all contacts fail query', function(done) {
      var node = KNode({
        transport: transports.UDP(AddressPortContact({
          address: '0.0.0.0',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var _queryContact = sinon.stub(
        node._router,
        '_queryContact'
      ).callsArgWith(2, new Error('Not reachable'));
      node._router._iterativeFind({}, [{
        address: '127.0.0.1',
        port: 1337,
        nodeID: utils.createID('nodeid')
      }], function(err) {
        _queryContact.restore();
        expect(err.message).to.equal(
          'Lookup operation failed to return results'
        );
        done();
      });
    });

  });

  describe('#_queryContact', function() {

    it('should remove the contact from the shortlist on error', function(done) {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var router = node._router;
      var _rpc = sinon.stub(router._rpc, 'send', function(c, m, cb) {
        cb(new Error());
      });
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      var state = router._createLookupState('VALUE', 'foo');
      state.shortlist.push(contact);
      router._queryContact(state, contact, function() {
        expect(state.shortlist).to.have.lengthOf(0);
        _rpc.restore();
        done();
      });
    });

  });

  describe('#_handleFindResult', function() {

    it('should track contact without value to store later', function(done) {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var router = node._router;
      var _rpc = sinon.stub(router._rpc, 'send', function(c, m, cb) {
        cb(new Error());
      });
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      var state = router._createLookupState('VALUE', 'foo');
      state.shortlist.push(contact);
      state.closestNodeDistance = '00000000000000000001';
      router._handleFindResult(state, {
        result: {
          nodes: []
        },
        id: utils.createID('test')
      }, contact, function() {
        expect(state.contactsWithoutValue).to.have.lengthOf(1);
        _rpc.restore();
        done();
      });
    });

    it('should remove contact from shortlist when JSON is bad', function(done) {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var router = node._router;
      var _rpc = sinon.stub(router._rpc, 'send', function(c, m, cb) {
        cb(new Error());
      });
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      var state = router._createLookupState('VALUE', 'foo');
      state.shortlist.push(contact);
      state.closestNodeDistance = '00000000000000000001';
      router._handleFindResult(state, {
        result: {
          item: 'BAD JSON'
        },
        id: utils.createID('test')
      }, contact, function() {
        expect(state.contactsWithoutValue).to.have.lengthOf(0);
        _rpc.restore();
        done();
      });
    });

    it('should remove contact from shortlist when invalid', function(done) {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0),
        validator: function(key, value, callback) {
          callback(false);
        }
      });
      var router = node._router;
      var _rpc = sinon.stub(router._rpc, 'send', function(c, m, cb) {
        cb(new Error());
      });
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      var state = router._createLookupState('VALUE', 'foo');
      state.shortlist.push(contact);
      state.closestNodeDistance = '00000000000000000001';
      var itemKey = utils.createID('beep');
      var publisherKey = utils.createID('publisher');
      var item = new Item(itemKey, 'boop', publisherKey);
      router._handleFindResult(state, {
        result: {
          item: item
        }
      }, contact, function() {
        expect(state.shortlist).to.have.lengthOf(0);
        _rpc.restore();
        done();
      });
    });

    it('should send key/value pair to validator', function(done) {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        validator: function(key, value) {
          expect(key).to.equal('foo');
          expect(value).to.equal('boop');
          done();
        },
        logger: new Logger(0)
      });
      var itemKey = utils.createID('foo');
      var publisherKey = utils.createID('publisher');
      var item = new Item(itemKey, 'boop', publisherKey);
      var state = node._router._createLookupState('VALUE', 'foo');
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      state.shortlist.push(contact);
      state.closestNodeDistance = '00000000000000000001';
      node._router._handleFindResult(state, {
        result: {
          item: item
        },
        id: utils.createID('test')
      }, contact, expect.fail);
    });

    it('should set the closest node and distance to current', function(done) {
      var StubRouter = proxyquire('../lib/router', {
        './utils': {
          compareKeys: sinon.stub().returns(-1),
          getDistance: sinon.stub().returns('2')
        }
      });
      var router = new StubRouter({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        logger: new Logger(0)
      });
      var state = router._createLookupState('VALUE', 'foo');
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      var _validate = sinon.stub(
        router,
        '_validateFindResult'
      ).callsArg(3);
      state.closestNode = '1';
      router._handleFindResult(state, {
        result: {
          item: {}
        },
        id: utils.createID('test')
      }, contact, function() {
        _validate.restore();
        expect(state.previousClosestNode).to.equal('1');
        expect(state.closestNode).to.equal(contact);
        expect(state.closestNodeDistance).to.equal('2');
        done();
      });
    });

  });

  describe('#_handleQueryResults', function() {

    it('should callback with the shortlist if it is full', function(done) {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var state = node._router._createLookupState(
        'VALUE',
        utils.createID('foo')
      );
      state.shortlist = new Array(constants.K);
      node._router._handleQueryResults(state, function(err, type, contacts) {
        expect(contacts).to.equal(state.shortlist);
        done();
      });
    });

  });

  describe('#_handleValueReturned', function() {

    it('should store at closest node that did not have value', function(done) {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var _send = sinon.stub(node._router._rpc, 'send');
      var contact1 = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      var contact2 = new AddressPortContact({ address: '0.0.0.0', port: 1235 });
      var state = node._router._createLookupState(
        'VALUE',
        utils.createID('foo')
      );
      state.item = {
        key: 'foo',
        value: 'bar',
        publisher: utils.createID('foo'),
        timestamp: Date.now()
      };
      state.contactsWithoutValue = [contact1, contact2];
      node._router._handleValueReturned(state, function() {
        expect(_send.callCount).to.equal(1);
        expect(_send.calledWith(contact1)).to.equal(true);
        done();
      });
    });

  });

  describe('#updateContact', function() {

    it('should not overfill a bucket', function(done) {
      this.timeout(10000);
      constants.T_RESPONSETIMEOUT = 10;
      expect(function() {
        var node = new KNode({
          transport: transports.UDP(AddressPortContact({
            address: '127.0.0.1',
            port: 0
          })),
          storage: new FakeStorage(),
          logger: new Logger(0)
        });
        var router = node._router;
        async.times(500, function(i, next) {
          router.updateContact(AddressPortContact({
            address: '127.0.0.' + i,
            port: 8080
          }), next);
        }, function(err) {
          constants.T_RESPONSETIMEOUT = 10;
          expect(err).to.not.be.instanceOf(Error);
          done();
        });
      }).to.not.throw(Error);
    });

  });

  describe('#getContactByNodeID', function() {

    it('should return the contact by node ID', function() {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var router = node._router;
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      router.updateContact(contact);
      expect(router.getContactByNodeID(contact.nodeID)).to.equal(contact);
    });

    it('should return null if contact not in table', function() {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var router = node._router;
      var contact = new AddressPortContact({ address: '0.0.0.0', port: 1234 });
      router.updateContact(contact);
      expect(router.getContactByNodeID('123412341234')).to.equal(null);
    });

    it('should return null if no contacts in table', function() {
      var node = new KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 0
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var router = node._router;
      var _nearest = sinon.stub(router, 'getNearestContacts').returns([]);
      expect(router.getContactByNodeID('123412341234')).to.equal(null);
      _nearest.restore();
    });

  });

});
