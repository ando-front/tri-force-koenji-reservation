// gas-mocha-adapter.js
// https://github.com/fossamagna/gas-mocha-adapter/blob/master/src/gas-mocha-adapter.js
// (MIT License)

function GasMochaAdapter() {
  this.stats = {
    suites: 0,
    tests: 0,
    passes: 0,
    pending: 0,
    failures: 0,
    start: new Date(),
    end: new Date(),
    duration: 0,
  };
  this.tests = [];
  this.currentSuite = '';
}

GasMochaAdapter.prototype.addTest = function (test) {
  this.tests.push(test);
};

GasMochaAdapter.prototype.getSummary = function () {
  this.stats.end = new Date();
  this.stats.duration = this.stats.end.getTime() - this.stats.start.getTime();
  return this.stats;
};

GasMochaAdapter.prototype.run = function () {
  const self = this;
  const describe = function (suiteName, fn) {
    self.currentSuite = suiteName;
    self.stats.suites++;
    fn.call(this);
  };

  const it = function (testName, fn) {
    self.stats.tests++;
    const test = {
      title: testName,
      fullTitle: self.currentSuite + ' ' + testName,
      duration: 0,
      err: null,
    };
    const start = new Date();
    try {
      fn.call(this);
      test.duration = new Date().getTime() - start.getTime();
      self.stats.passes++;
    } catch (e) {
      test.err = e;
      test.duration = new Date().getTime() - start.getTime();
      self.stats.failures++;
    }
    self.addTest(test);
  };

  // Run tests
  eval(
    UrlFetchApp.fetch(
      'https://raw.githubusercontent.com/fossamagna/gas-mocha-adapter/master/src/gas-mocha-adapter-lib.js'
    ).getContentText()
  );
  eval(UrlFetchApp.fetch('https://script.google.com/macros/s/1U5BGrBwdlH5aRjrI9pkFX6iDhgnS8lw0u1ZYh7k3juL8n0Awb7d16pYt/exec').getContentText()); // This should point to the src/code.gs file after deployment

  return this;
};

// Expose for testing
if (typeof module !== 'undefined') {
  module.exports = GasMochaAdapter;
}
