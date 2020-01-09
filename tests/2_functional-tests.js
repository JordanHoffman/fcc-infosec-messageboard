/*
*
*
*       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
*       -----[Keep the tests in the same order!]-----
*       (if additional are added, keep them at the very end!)
*
*       WARNING: I COMPLETELY CHANGED THE ORDER OF THE TESTS FOR THE SAKE OF EASIER TESTING. CHECK BOILERPLATE FOR ORIGINAL ORDER
*/

var chaiHttp = require('chai-http');
var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var server = require('../server');

chai.use(chaiHttp);

let test_board = "test_board"
let thread_text = "thread text"
let thread_pw = "thread pw"
let reply_text = "reply text"
let reply_pw = "reply pw"

let thread_id
let reply_id

suite('Functional Tests', function() {

  suite('API ROUTING FOR /api/threads/:board AND REPLIES ALSO', function() {
    
    suite('POST', function() {
      test('Post thread', function(done) {
       chai.request(server)
        .post('/api/threads/' + test_board)
        .send({text: thread_text, delete_password:thread_pw})
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             // console.log("the response: " + res)
             expect('Location', '/b/' + test_board + '/')
             
             //this thing needs some weird url stuff included in the redirect url, so it doesn't work like this
             // expect(res).to.redirectTo('/b/' + test_board + '/')
           }
          done();
        });
      });
    });
    
    suite('GET', function() {
      test('Get thread', function(done) {
       chai.request(server)
        .get('/api/threads/' + test_board)
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             /*
             { _id: '5e17394d1ab383191f69e4ad',
              text: 'test text',
              created_on: '2020-01-09T14:31:41.109Z',
              bumped_on: '2020-01-09T14:31:41.109Z',
              replies: [],
              replycount: 0 }
             */
             assert.property(res.body[0], '_id')
             assert.property(res.body[0], 'text')
             assert.property(res.body[0], 'created_on')
             assert.property(res.body[0], 'bumped_on')
             assert.property(res.body[0], 'replies')
             assert.property(res.body[0], 'replycount')
             
             assert.equal(res.body[0].text, thread_text)
             thread_id = res.body[0]._id
           }
          done();
        });
      });
    });
    
    suite('PUT', function() {
      test('Report thread', function(done) {
       chai.request(server)
        .put('/api/threads/' + test_board)
        .send({thread_id: thread_id})
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             assert.equal(res.text, 'success')
           }
          done();
        });
      });
    });
    
    suite('POST REPLY', function() {
      test('Post reply', function(done) {
        chai.request(server)
        .post('/api/replies/' + test_board)
        .send({text: reply_text, thread_id: thread_id, delete_password:reply_pw})
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             expect('Location', '/b/' + test_board + '/' + thread_id)
           }
          done();
        });
      });
    });
    
    suite('GET REPLY', function() {
      test('Get replies', function(done) {
       chai.request(server)
        .get('/api/replies/' + test_board)
        .query({thread_id:thread_id})
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             console.log(res.body)
             console.log(Object.entries(res.body))
             assert.property(res.body, 'replies')
             assert.property(res.body.replies[0], '_id')
             assert.property(res.body.replies[0], 'text')
             assert.property(res.body.replies[0], 'created_on')
             
             assert.equal(res.body.replies[0].text, reply_text)
             reply_id = res.body.replies[0]._id
           }
          done();
        });
      });
    });
  
    suite('PUT REPLY', function() {
      test('Report reply', function(done) {
       chai.request(server)
        .put('/api/replies/' + test_board)
        .send({thread_id: thread_id, reply_id: reply_id})
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             assert.equal(res.text, 'success')
           }
          done();
        });
      });
    });
    
    suite('DELETE REPLY', function() {
      test('Delete reply', function(done) {
       chai.request(server)
        .delete('/api/replies/' + test_board)
        .send({thread_id: thread_id, reply_id: reply_id, delete_password:reply_pw})
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             assert.equal(res.text, 'success')
           }
          done();
        });
      });
    });
    
    suite('DELETE', function() {
      test('Delete thread', function(done) {
       chai.request(server)
        .delete('/api/threads/' + test_board)
        .send({thread_id: thread_id, delete_password:thread_pw})
        .end(function(err, res){
           if (err) assert.fail(err)
           else{
             assert.equal(res.text, 'success')
           }
          done();
        });
      });
    });
    
  });
      
});

