describe('Tube', function () {

  var http = null;
  var pebble = null;
  var tube = null;

  beforeEach(function () {
    http = new MockHttp();
    pebble = new MockPebble();
    tube = new Tube({ pebble: pebble, http: http, debug: false });
  });


  it('should listen for the ready event', function (done) {
    expect(pebble._getEventListeners('ready').length).to.equal(1);
    done();
  });


  it('should listen for app messages when ready', function (done) {
    pebble._emit('ready', { ready: true });
    expect(pebble._getEventListeners('appmessage').length).to.equal(1);
    done();
  });


  it('should respond to tube app message', function (done) {
    http.addHandler(function (url, data, callback) {
      return callback(null, {
        response: {
          lines: [
          ]
        }
      });
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.equal('TUBE');
      expect(payload.operation).to.equal('UPDATE');
      expect(typeof(payload.data)).to.equal('string');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  });


  it('should handle being offline', function (done) {
    http.addHandler(function (url, data, callback) {
      return callback(new Error('NOT_CONNECTED'));
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.equal('ERROR');
      expect(payload.operation).to.equal('HTTP');
      expect(payload.data).to.equal('OFFLINE');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  });


  it('should create a properly formatted string', function (done) {
    http.addHandler(function (url, data, callback) {
      return callback(null, {
        response: {
          lines: [
            { name: 'Bakerloo', status: 'good service' }
          ]
        }
      });
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.equal('TUBE');
      expect(payload.operation).to.equal('UPDATE');
      expect(payload.data).to.equal('1|Bakerloo|Good Service');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  });


  it('should order lines by severity of problem', function (done) {
    http.addHandler(function (url, data, callback) {
      return callback(null, {
        response: {
          lines: [
            { name: 'Bakerloo', status: 'good service' },
            { name: 'Central', status: 'part closure' },
            { name: 'Northern', status: 'severe delays' }
          ]
        }
      });
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.equal('TUBE');
      expect(payload.operation).to.equal('UPDATE');
      expect(payload.data).to.equal('3|Central|Part Closure|Northern|Severe Delays|Bakerloo|Good Service');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  });

  it('should order lines with the same severity by name', function (done) {
    http.addHandler(function (url, data, callback) {
      return callback(null, {
        response: {
          lines: [
            { name: 'Central', status: 'good service' },
            { name: 'Northern', status: 'good service' },
            { name: 'Bakerloo', status: 'good service' }
          ]
        }
      });
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.equal('TUBE');
      expect(payload.operation).to.equal('UPDATE');
      expect(payload.data).to.equal('3|Bakerloo|Good Service|Central|Good Service|Northern|Good Service');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  });

  it('should order line status by severity of problem', function (done) {
    http.addHandler(function (url, data, callback) {
      return callback(null, {
        response: {
          lines: [
            { name: 'Central', status: 'good service, minor delays, part closure' }
          ]
        }
      });
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.be.equal('TUBE');
      expect(payload.operation).to.be.equal('UPDATE');
      expect(payload.data).to.equal('1|Central|Part Closure, Minor Delays, Good Service');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  });


  it('should remove duplicate lines', function (done) {
    http.addHandler(function (url, data, callback) {
      return callback(null, {
        response: {
          lines: [
            { name: 'Bakerloo', status: 'good service' },
            { name: 'Northern', status: 'good service' },
            { name: 'Bakerloo', status: 'good service' },
          ]
        }
      });
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.equal('TUBE');
      expect(payload.operation).to.equal('UPDATE');
      expect(payload.data).to.equal('2|Bakerloo|Good Service|Northern|Good Service');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  });

  it('should work with the real API source', function (done) {
    var responseData = null;
    http.addHandler(function (url, data, callback) {
      var req = new XMLHttpRequest();
      req.open('GET', url, true);
      req.onload = function () {
        if (req.readyState === 4 && req.status === 200) {
          if (req.status === 200) {
            responseData = JSON.parse(req.responseText);
            return callback(null, responseData);
          }
        }
        return callback(new Error('HTTP + ' + req.status));
      };
      req.onerror = function () {
        return callback(new Error('HTTP + ' + req.status));
      };
      req.send();
    });
    pebble._on('appmessage', function (payload) {
      expect(payload.group).to.equal('TUBE');
      expect(payload.operation).to.equal('UPDATE');
      expect(typeof(payload.data)).to.equal('string');
      done();
    });
    pebble._emit('ready', { ready: true });
    pebble._emit('appmessage', { payload: { group: 'TUBE', operation: 'UPDATE', data: '' } });
  })

});