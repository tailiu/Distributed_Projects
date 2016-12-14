'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');
var KNode = require('../lib/node');
var transports = require('../lib/transports');
var Logger = require('../lib/logger');
var AddressPortContact = require('../lib/contacts/address-port-contact');
var FakeStorage = require('kad-memstore');
var Router = require('../lib/router');

Router.PING_TTL = 0;

var storage1 = new FakeStorage();
var storage2 = new FakeStorage();
var storage3 = new FakeStorage();
var storage4 = new FakeStorage();
var storage5 = new FakeStorage();
var storage6 = new FakeStorage();
var storage10 = new FakeStorage();
var storage11 = new FakeStorage();

var node1;
var node2;
var node3;
var node4;
var node5;
var node6;
var node10;
var node11;

var node1opts = {
  transport: transports.UDP(AddressPortContact({
    address: '127.0.0.1',
    port: 65526
  })),
  storage: storage1,
  logger: new Logger(0)
};
var node2opts = {
  transport: transports.UDP(AddressPortContact({
    address: '127.0.0.1',
    port: 65527
  })),
  storage: storage2,
  logger: new Logger(0)
};
var node3opts = {
  transport: transports.UDP(AddressPortContact({
    address: '127.0.0.1',
    port: 65522
  })),
  storage: storage3,
  logger: new Logger(0)
};
var node4opts = {
  transport: transports.TCP(AddressPortContact({
    address: '127.0.0.1',
    port: 65523
  })),
  storage: storage4,
  logger: new Logger(0)
};
var node5opts = {
  transport: transports.TCP(AddressPortContact({
    address: '127.0.0.1',
    port: 65524
  })),
  storage: storage5,
  logger: new Logger(0)
};
var node6opts = {
  transport: transports.TCP(AddressPortContact({
    address: '127.0.0.1',
    port: 65525
  })),
  storage: storage6,
  logger: new Logger(0)
};
var node10opts = {
  transport: transports.HTTP(AddressPortContact({
    address: '127.0.0.1',
    port: 30000
  })),
  storage: storage10,
  logger: new Logger(0)
};
var node11opts = {
  transport: transports.HTTP(AddressPortContact({
    address: '127.0.0.1',
    port: 30001
  })),
  storage: storage11,
  logger: new Logger(0)
};

describe('Node+Router', function() {

  describe('@constructor', function() {

    it('should create an instance with the `new` keyword', function() {
      expect(new KNode({
        storage: storage1,
        transport: transports.UDP(AddressPortContact({
          address: '0.0.0.0',
          port: 0
        })),
        logger: new Logger(0)
      })).to.be.instanceOf(KNode);
    });

    it('should create an instance without the `new` keyword', function() {
      expect(KNode({
        storage: storage1,
        transport: transports.UDP(AddressPortContact({
          address: '0.0.0.0',
          port: 0
        })),
        logger: new Logger(0)
      })).to.be.instanceOf(KNode);
    });

    it('should throw if no storage adapter is supplied', function() {
      expect(function() {
        KNode({
          transport: transports.UDP(AddressPortContact({
            address: '0.0.0.0',
            port: 0
          })),
          logger: new Logger(0)
        });
      }).to.throw(Error, 'No storage adapter supplied');
    });

  });

  describe('#connect', function() {

    it('should connect node2 to node1 over udp and emit join', function(done) {
      var tests = 0;
      function finished() {
        tests++;
        if (tests === 2) {
          done();
        }
      }
      node1 = KNode(node1opts);
      node1.on('join', finished);
      node2 = KNode(node2opts);
      node2.connect(node1._self, function() {
        expect(Object.keys(node2._router._buckets)).to.have.lengthOf(1);
        finished();
      });
    });

    it('should connect node3 to node2 and update connected', function(done) {
      node3 = KNode(node3opts);
      expect(node3.connected).to.equal(false);
      node3.connect(node2._self).once('join', function() {
        expect(Object.keys(node3._router._buckets)).to.have.lengthOf(1);
        expect(node3.connected).to.equal(true);
        done();
      });
    });

    it('should connect node1 to node3 over udp', function(done) {
      node1.connect(node3._self, function() {
        expect(Object.keys(node1._router._buckets)).to.have.lengthOf(1);
        done();
      });
    });

    it('should connect node5 to node4 over tcp', function(done) {
      node4 = KNode(node4opts);
      node5 = KNode(node5opts);
      node5.connect(node4._self, function() {
        expect(Object.keys(node5._router._buckets)).to.have.lengthOf(1);
        done();
      });
    });

    it('should connect node6 to node5 over tcp', function(done) {
      node6 = KNode(node6opts);
      node6.connect(node5._self, function() {
        expect(Object.keys(node6._router._buckets)).to.have.lengthOf(2);
        done();
      });
    });

    it('should connect node4 to node6 over tcp', function(done) {
      node4.connect(node6._self, function() {
        expect(Object.keys(node4._router._buckets)).to.have.lengthOf(1);
        done();
      });
    });

    it('should connect node10 to node11 over http', function(done) {
      node10 = KNode(node10opts);
      node11 = KNode(node11opts);
      node10.connect(node11._self, function() {
        expect(Object.keys(node10._router._buckets)).to.have.lengthOf(1);
        done();
      });
    });

    it('should reopen the transport if closed', function(done) {
      node11.disconnect(function() {
        node11.connect(node10._self, function(err) {
          expect(err).to.equal(null);
          done();
        });
      });
    });

    it('should emit an error if the connection fails', function(done) {
      var node = KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 65532
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      var _findNode = sinon.stub(node._router, 'findNode', function(id, o, cb) {
        return cb(new Error('fatal error'));
      });
      node.connect({ address: '127.0.0.1', port: 3333 }, function(err) {
        expect(err.message).to.equal('fatal error');
        _findNode.restore();
        done();
      });
    });

  });

  describe('#disconnect', function() {

    it('should close transport, empty router, and emit leave', function(done) {
      node10.once('leave', function() {
        expect(node10._router.length).to.equal(0);
        expect(node10._rpc.readyState).to.equal(0);
        done();
      }).disconnect();
    });

    it('should immediately callback if already closed', function(done) {
      expect(node10._rpc.readyState).to.equal(0);
      node10.disconnect(function() {
        expect(node10._rpc.readyState).to.equal(0);
        done();
      });
    });

  });

  describe('#_replicate', function() {

    it('publisher should be consistent after replication', function(done) {
      node10.connect(node11._self, function() {
        node10.put('some-key', 'some-val', function(err) {
          expect(err).to.equal(undefined);
          var replicate = node11._replicate.bind(node2);
          replicate();
          setTimeout(function () {
            node10._storage.get('some-key', function(err, data1) {
              node11._storage.get('some-key', function(err, data2) {
                var parsed1 = JSON.parse(data1);
                var parsed2 = JSON.parse(data2);
                expect(parsed1.publisher).to.be.equal(node10._self.nodeID);
                expect(parsed2.publisher).to.be.equal(node10._self.nodeID);
                done();
              });
            });
          }, 300);
        });
      });
    });

  });

  describe('#put', function() {

    it('should succeed in setting the value to the dht', function(done) {
      node1.put('beep', 'boop', function(err) {
        expect(err).to.equal(undefined);
        done();
      });
    });

    it('should succeed in setting the value to the dht', function(done) {
      node10.put('object', { beep: 'boop' }, function(err) {
        expect(err).to.equal(undefined);
        done();
      });
    });

    it('should pass an error to the callback if failed', function(done) {
      var _set = sinon.stub(node2, 'put', function(k, v, cb) {
        cb(new Error('fail'));
      });
      node2.put('beep', 'boop', function(err) {
        expect(err.message).to.equal('fail');
        _set.restore();
        done();
      });
    });

    it('should store locally if _findNode fails', function(done) {
      var node = KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 65530
        })),
        storage: new FakeStorage(),
        logger: new Logger(0)
      });
      node.put('beep', 'boop', function(err) {
        expect(err).to.equal(undefined);
        done();
      });
    });

    it('should always store item locally', function(done) {
      var storage = new FakeStorage();
      var node = KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 65529
        })),
        storage: storage,
        logger: new Logger(0)
      });
      var findNode = sinon.stub(node._router, 'findNode').callsArgWith(1, null,
        [
          AddressPortContact({ address: '127.0.0.1', port: 65530 }),
          AddressPortContact({ address: '127.0.0.1', port: 65531 }),
          AddressPortContact({ address: '127.0.0.1', port: 65532 })
        ]
      );
      var send = sinon.stub(node._rpc, 'send').callsArg(2);
      node.put('beep', 'boop', function(err) {
        expect(!!err).to.equal(false);
        storage.get('beep', function(err, item) {
          expect(!!item).to.equal(true);
          findNode.restore();
          send.restore();
          done();
        });
      });
    });

    it('should log error if a critical error from RPC', function(done) {
      var logger = new Logger(0);
      logger.error = sinon.stub();
      var node = KNode({
        transport: transports.UDP(AddressPortContact({
          address: '127.0.0.1',
          port: 65528
        })),
        storage: new FakeStorage(),
        logger: logger
      });
      var error = new Error('Failed');
      var send = sinon.stub(node._rpc, 'send').callsArgWith(2, error);
      var findNode = sinon.stub(node._router, 'findNode').callsArgWith(1, null,
        [
          AddressPortContact({ address: '127.0.0.1', port: 65530 }),
          AddressPortContact({ address: '127.0.0.1', port: 65531 }),
          AddressPortContact({ address: '127.0.0.1', port: 65532 })
        ]
      );
      node.put('beep', 'boop', function() {
        expect(logger.error.called).to.equal(true);
        send.restore();
        findNode.restore();
        done();
      });
    });

  });

  describe('#get', function() {

    it('should succeed in getting the value from the dht', function(done) {
      node1.get('beep', function(err, value) {
        expect(err).to.equal(null);
        expect(value).to.equal('boop');
        done();
      });
    });

    it('should succeed in getting the value from the dht', function(done) {
      node10.get('object', function(err, value) {
        expect(err).to.equal(null);
        expect(value.beep).to.equal('boop');
        done();
      });
    });

    it('should pass an error to the callback if failed', function(done) {
      var _get = sinon.stub(node3, 'get', function(k, cb) {
        cb(new Error('fail'));
      });
      node3.get('beep', function(err) {
        expect(err.message).to.equal('fail');
        _get.restore();
        done();
      });
    });

  });

});
