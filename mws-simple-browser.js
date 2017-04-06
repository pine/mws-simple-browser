/*
 * mws-simple-browser.js: browser Amazon MWS API in 100 lines of code
 */
'use strict';
var crypto = require('crypto');
var request = require('browser-request');
var xmlParser = require('xml2js').parseString;
var tabParser = require('csv-parse');
var qs = require('query-string');

// Client is the class constructor
module.exports = Client;

function Client(opts) {
  // force 'new' constructor
  if (!(this instanceof Client)) return new Client(opts);

  this.host = opts.host || 'mws.amazonservices.com';
  this.port = opts.port || 443

  if (opts.accessKeyId) this.accessKeyId = opts.accessKeyId;
  if (opts.secretAccessKey) this.secretAccessKey = opts.secretAccessKey;
  if (opts.merchantId) this.merchantId = opts.merchantId;
}

//
// http://docs.developer.amazonservices.com/en_US/dev_guide/DG_ClientLibraries.html
//
Client.prototype.request = function(requestData, callback) {
  // Try to allow all assumptions to be overriden by caller if needed
  if (!requestData.path) {
    requestData.path = '/';
  }
  if (!requestData.query.Timestamp) {
    requestData.query.Timestamp = (new Date()).toISOString();
  }
  if (!requestData.query.AWSAccessKeyId) {
    requestData.query.AWSAccessKeyId = this.accessKeyId;
  }
  if (!requestData.query.SellerId) {
    requestData.query.SellerId = this.merchantId;
  }
  if (!requestData.responseFormat) {
    requestData.responseFormat = 'xml';
  }

  // Create the Canonicalized Query String
  requestData.query.SignatureMethod = 'HmacSHA256';
  requestData.query.SignatureVersion = '2';
  // qs.stringify will sorts the keys and url encode
  var stringToSign = ["POST", this.host, requestData.path, qs.stringify(requestData.query)].join('\n');
  requestData.query.Signature = crypto.createHmac('sha256', this.secretAccessKey).update(stringToSign).digest('base64');

  var options = {
    url: 'https://' + this.host + ':' + this.port + requestData.path,
    headers: {},
    qs: requestData.query
  }

  // Use specified Content-Type or assume one
  if (requestData.headers && requestData.headers['Content-Type']) {
    options.headers['Content-Type'] = requestData.headers['Content-Type'];
  } else if (requestData.feedContent) {
    if (requestData.feedContent.slice(0, 5) === '<?xml') {
      options.headers['Content-Type'] = 'text/xml';
    } else {
      options.headers['Content-Type'] = 'text/tab-separated-values; charset=iso-8859-1';
    }
  } else {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
  }

  // Add body content if any
  if (requestData.feedContent) {
    options.body = requestData.feedContent;
    options.headers['Content-MD5'] = crypto.createHash('md5').update(requestData.feedContent).digest('base64');
  }

  // Make call to MWS
  request.post(options, function (error, response, body) {
    if (error) return callback(error);

    if (response.body.slice(0, 5) === '<?xml') {
      // xml2js
      xmlParser(body, function (err, result) {
        callback(err, result);
      });
    } else {
      // currently only other type of data returned is tab-delimited text
      tabParser(body, {
        delimiter:'\t',
        columns: true,
        relax: true
      }, callback);
    }
  });
};
