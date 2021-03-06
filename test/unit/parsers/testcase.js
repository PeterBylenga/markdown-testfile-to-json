'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var rewire = require('rewire');
var TestcaseParser = rewire('../../../lib/parsers/testcase');

describe('TestcaseParser', function () {

  function TestcaseMock() {}
  TestcaseMock.isValidState = function() {};
  TestcaseParser.__set__("Testcase", TestcaseMock);

  var errorHandlerMock = {
    add: function() {}
  };

  TestcaseParser.__set__('errorHandler', errorHandlerMock);
  var addMock = sinon.stub(errorHandlerMock, 'add');


  var testcaseNotSanitized;

  beforeEach(function() {
    testcaseNotSanitized = {};
  });

  afterEach(function() {
    addMock.reset();
  });

  describe('parse()', function() {
    var testcaseSpy;
    var token;

    before(function() {
      testcaseSpy = sinon.spy(TestcaseMock);
      TestcaseParser.__set__("Testcase", testcaseSpy);

      sinon.spy(TestcaseParser, '_handleParagraph');
      sinon.spy(TestcaseParser, '_handleTable');
    });

    beforeEach(function() {
      testcaseSpy.reset();
      TestcaseParser._handleParagraph.reset();
      TestcaseParser._handleTable.reset();
    });

    after(function() {
      TestcaseParser.__set__("Testcase", TestcaseMock);
    });

    it('should return a Testcase', function() {
      token = {
        name: '',
        childrenTokens: []
      };
      var testcase = TestcaseParser.parse(token);
      assert.isDefined(testcase);
      assert.ok(testcaseSpy.called);
    });

    it('should initialize the id', function() {
      token = {
        name: 'id',
        childrenTokens: []
      };
      TestcaseParser.parse(token);
      assert.ok(testcaseSpy.calledWith('id'));
    });

    it('should call _handleParagraph() if a paragraph is a following token', function() {
      token = {
        childrenTokens: [{
          type: 'paragraph',
          text: 'text'
        }]
      };

      TestcaseParser.parse(token);
      assert.ok(TestcaseParser._handleParagraph.calledOnce);
    });

    it('should call _handleTable() if a table is a following token', function() {
      token = {
        childrenTokens: [{
          type: 'table',
          header: ['text'],
          cells: [['']]
        }]
      };

      TestcaseParser.parse(token);
      assert.ok(TestcaseParser._handleTable.calledOnce);
    });

    it('should handle multiple following tokens', function() {
      token = {
        childrenTokens: [{
          type: 'paragraph',
          text: 'text'
        },{
          type: 'paragraph',
          text: 'text2'
        }]
      };

      TestcaseParser.parse(token);
      assert.ok(TestcaseParser._handleParagraph.calledTwice);
    });

    it('should add an error if a following token is not supported at this level', function() {
      token = {
        childrenTokens: [{
          type: 'header'
        }]
      };

      TestcaseParser.parse(token);
      sinon.assert.calledWith(addMock, new Error('"header" is not supported in test cases'));
    });
  });

  describe('_handleParagraph()', function() {
    it('should call _handleDecorators() if ` was found', function() {
      var decoratorsParagraph = '`bug 1`';
      var token = { text: decoratorsParagraph };
      sinon.spy(TestcaseParser, '_handleDecorators');

      TestcaseParser._handleParagraph(testcaseNotSanitized, token);

      assert(TestcaseParser._handleDecorators
        .calledWith(testcaseNotSanitized, decoratorsParagraph.split('`')));
    });

    it('should attach the instructions if no ` was found', function() {
      var instructions = 'Do some testing';
      var token = { text: instructions };
      TestcaseParser._handleParagraph(testcaseNotSanitized, token);
      assert.strictEqual(testcaseNotSanitized.instructions, instructions);
    });
  });

  describe('_handleTable()', function() {
    it('should attach the variables', function() {
      var token = {
        header: ['key'],
        cells: [['value']]
      };

      TestcaseParser._handleTable(testcaseNotSanitized, token);
      assert.deepEqual(testcaseNotSanitized.variables, [
        { key: 'value' }
      ]);
    });

    it('should support multiple values for the same key', function() {
      var token = {
        header: ['key'],
        cells: [['value1'], ['value2']]
      };

      TestcaseParser._handleTable(testcaseNotSanitized, token);
      assert.deepEqual(testcaseNotSanitized.variables, [
        { key: 'value1' },
        { key: 'value2' }
      ]);
    });

    it('should support multiple keys', function() {
      var token = {
        header: ['key1', 'key2'],
        cells: [['value11', 'value12']]
      };

      TestcaseParser._handleTable(testcaseNotSanitized, token);
      assert.deepEqual(testcaseNotSanitized.variables, [
        { key1: 'value11', key2: 'value12' }
      ]);
    });

    it('should support multiple keys and values', function() {
      var token = {
        header: ['key1', 'key2'],
        cells: [['value11', 'value12'], ['value21', 'value22']]
      };

      TestcaseParser._handleTable(testcaseNotSanitized, token);
      assert.deepEqual(testcaseNotSanitized.variables, [
        { key1: 'value11', key2: 'value12' },
        { key1: 'value21', key2: 'value22' }
      ]);
    });
  });

  describe('_handleDecorator()', function() {

    var isValidStateMock = sinon.stub(TestcaseMock, 'isValidState');

    it('should attach the bug number', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['bug 1']);
      assert.strictEqual(testcaseNotSanitized.bug, '1');
    });

    it('should attach the user story number', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['story 2']);
      assert.strictEqual(testcaseNotSanitized.userStory, '2');
    });

    it('should attach the state of the bug', function() {
      isValidStateMock.withArgs('xfail').returns(true);
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['xfail']);
      assert.strictEqual(testcaseNotSanitized.state, 'xfail');
    });

    it('should handle multiple decorators', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['bug 1', 'story 2']);
      assert.strictEqual(testcaseNotSanitized.bug, '1');
      assert.strictEqual(testcaseNotSanitized.userStory, '2');
    });

    it('should trim the values', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, [' bug 1 ']);
      assert.strictEqual(testcaseNotSanitized.bug, '1');
    });

    it('should exclude the blank lines', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['\n']);
      sinon.assert.callCount(addMock, 0);
    });

    it('should add an error if the decorator is not supported', function() {
      isValidStateMock.withArgs('invalidDecorator').returns(false);

      TestcaseParser._handleDecorators(testcaseNotSanitized, ['invalidDecorator']);
      sinon.assert.calledWith(addMock, new Error('"invalidDecorator" is not a supported decorator.'));
    });

    it('should add an error if there is no space between "bug" and the number', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['bug1']);
      sinon.assert.calledWith(addMock, new Error('"bug1" is not a supported decorator.'));
    });

    it('should add an error if "bug" is not the first word', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['fake bug 1']);
      sinon.assert.calledWith(addMock, new Error('"fake bug 1" is not a supported decorator.'));
    });

    it('should add an error if "bug" is not in lowercase', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['Bug 1']);
      sinon.assert.calledWith(addMock, new Error('"Bug 1" is not a supported decorator.'));
    });

    it('should add an error if "bug" is not a single word', function() {
      TestcaseParser._handleDecorators(testcaseNotSanitized, ['bugzilla 1']);
      sinon.assert.calledWith(addMock, new Error('"bugzilla 1" is not a supported decorator.'));
    });

    // TODO, this edge case is currently not supported.
    // it('should add an error if a value is already assigned', function() {
    //
    // });
  });
});
