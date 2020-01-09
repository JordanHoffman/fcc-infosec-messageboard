/*

Setup: 
- Boards hold threads. Boards are unique by their name. A new board is only created when a thread is created specifying a board that doesn't exist.

- threads: post contains board name, text and delete_password data. Saved will be _id, text, created_on(date&time), bumped_on(date&time, starts same as created_on), reported(boolean), delete_password, & replies(array).
**BEWARE: I think thread also has the variable replycount within the board.html view.

- A thread reply is posted with data: text, delete_password, & thread_id, which would get stored in the thread doc's replies array, saved as  _id, text, created_on, delete_password, & reported. The thread's bumped_on date/time is updated to the reply's.

TODO:
12. Complete functional tests that wholely test routes and pass.

TAKEAWAYS: a res.redirect doesnt work if the request origin is from ajax, need to code it in the ajax to change window url via window.location.href. If my error url in jquery/ajax whatever is not properly URIencoded, it's not gonna work and it took forever to find that out.
*/

'use strict';

var expect = require('chai').expect;
var ObjectID = require('mongodb').ObjectID
var request = require('request')
module.exports = function (app, db) {
  
/*
body comes as object like this for new thread creation: {board:"..", text:"..", delete_password:".."}
board also is passed via req.params.board.

setup for 1 possible board doc with embedded thread and replies docs. Manually insert _id for embedded docs: 
  {
    board: "boardname"
    threads: 
    [
      {_id: "..", text: "..", created_on(date&time): "..", bumped_on(date&time, starts same as created_on): "..", reported(boolean):"..", delete_password:"..", 
      replies:
        [
          {_id:"..", text:"..", created_on:"..", delete_password:"..", reported:".."},
          {"next reply"}
        ]
      },
      {"next thread"}
    ]
  }
*/

function handleError(req, res, myMessage, error){
  console.log(error)
  let fullRedirectURL = "/error?"
  if(myMessage !== undefined) fullRedirectURL += ("myMessage=" + myMessage)
  if(error !== undefined) fullRedirectURL += ("&error=" + error.stack)
  //responses can't redirect if request is originally from ajax, so I have to account for errors originating from ajax requests
  if (req.xhr){
    console.log("hooray ajax")
    res.status(400).send(fullRedirectURL)
    return
  }
  res.redirect(fullRedirectURL)
  return
}

app.route('/api/threads/:board').post(async function (req, res)
{
  //check if board exists, if not then create along with thread, else just add thread
  let boardName = req.params.board
  let creationTime = new Date().toISOString()
  
  let newThread = {_id: new ObjectID(), text: req.body.text, created_on: creationTime, bumped_on: creationTime, reported: false, delete_password: req.body.delete_password, replies:[], replycount: 0}
  
  //attempt to find board
  let dbBoard = null
  try {
    dbBoard = await db.collection('messageboards').findOne({board: boardName})
  } catch(e) {
    handleError(req, res, "error finding board " + boardName, e)
    return
  }
  
  //board not found in db, create board with thread
  if (dbBoard == null) 
  {
    try {
      await db.collection('messageboards').insertOne({board: boardName, threads:[newThread]})
      console.log('succesfully inserted new board ' + boardName + ' with thread ' + req.body.text)
      res.redirect('/b/' + boardName + '/')
    } catch(e) {
      handleError(req, res, "error inserting new board " + boardName, e)
    }
    return
  }
  
  //board found in db, update with new thread
  try {
    await db.collection('messageboards').findOneAndUpdate(
      {board:boardName},
      {$set: {threads: [newThread].concat(dbBoard.threads)}},
      {returnOriginal: false}
    )
    console.log('succesfully updated board ' + boardName + ' with thread ' + req.body.text)
    res.redirect('/b/' + boardName + '/')
  } catch(e) {
    handleError(req, res, "error updating board " + boardName, e)
  }
  return
})

//called within board.html to get the threads array from a board doc, but can also be manually typed as the url or linked to
app.route('/api/threads/:board').get(async function (req, res)
{
  let boardName = req.params.board
  //attempt to find board
  let dbBoard = null
  try {
    dbBoard = await db.collection('messageboards').findOne({board: boardName})
  } catch(e) {
    handleError(req, res, "error finding board " + boardName, e)
    return
  }
  
  if (dbBoard == null){
    handleError(req, res, "the board \"" + boardName + "\" couldn't be found for the GET board.html. If the url was manually input, the board may not exist, otherwise something is wrong.", undefined)
    return
  }
  
  //limit to 10 threads sorted by bumped_on date, limited to 3 most recent replies per thread. Remove reported and delete_password for all threads and all their replies
  dbBoard.threads.sort((a, b) => new Date(b.bumped_on) - new Date(a.bumped_on))
  dbBoard.threads = dbBoard.threads.slice(0, 10)
  
  dbBoard.threads.forEach(thread => {
    delete thread.delete_password
    delete thread.reported
    thread.replies.sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
    thread.replies = thread.replies.slice(0, 3)
    thread.replies.forEach(reply => {delete reply.delete_password; delete reply.reported})
  })
  
  res.send(dbBoard.threads)
  return
})

//thread_id, delete_password
app.route('/api/threads/:board').delete(async function (req, res){
  let boardName = req.params.board
  let thread_id = req.body.thread_id
  let delete_password = req.body.delete_password
  
  if (!ObjectID.isValid(thread_id)){
    console.log("invalid _id: " + thread_id)
    res.send("incorrect password")
    return
  }
  
  //Attempt to remove thread. If anything is wrong (wrong _id or p/w) but doesn't cause an error, then the thread will not be found and result.value will be null. Otherwise it should work. Default failure response for everything is "incorrect password" as per instructions
  let result = null
  try {
    result = await db.collection('messageboards').findOneAndUpdate(
      {board:boardName, "threads._id": ObjectID.createFromHexString(thread_id)},
      {$pull: {threads: {_id:ObjectID.createFromHexString(thread_id)}}},
      {returnOriginal: false}
    )
  } catch(e) {
    handleError(req, res, "error updating board " + boardName + " to remove thread: " + thread_id, e)
    return
  }
  
  if (result.value == null){
    res.send("incorrect password")
    return
  }
  
  console.log('succesfully updated board ' + boardName + ' to remove thread: ' + thread_id)
  res.send('success')
  return
})

//body: board, thread_id
app.route('/api/threads/:board').put(async function (req, res){
  let boardName = req.params.board
  let thread_id = req.body.thread_id
  
  if (!ObjectID.isValid(thread_id)){
    console.log("invalid _id: " + thread_id)
    res.send("incorrect password")
    return
  }
  
  thread_id = ObjectID.createFromHexString(thread_id)
  let result = null
  try {
    result = await db.collection('messageboards').findOneAndUpdate(
      {board:boardName, "threads._id": thread_id},
      {$set: {"threads.$.reported": true}},
      {returnOriginal: false}
    )
  } catch(e) {
    handleError(req, res, "error reporting thread " + thread_id, e)
    return
  }
  
  if (result.value == null){
    console.log("board: " + boardName + " and thread: " + thread_id + " could not be found to report thread") 
    res.send("incorrect password")
    return
  }
  
  console.log('succesfully reported thread ' + thread_id)
  res.send("success")
  return
})

// - A thread reply is posted with data: text, delete_password, & thread_id, which would get stored in the thread doc's replies array, saved as  _id, text, created_on, delete_password, & reported. The thread's bumped_on date/time is updated to the reply's.
app.route('/api/replies/:board').post(async function (req, res)
{
  //findAndUpdate the thread. Gotta check if baord exists, if thread _id is valid and if thread for that _id exists.
  //attempt to find board
  let boardName = req.params.board
  let dbBoard = null
  
  try {
    dbBoard = await db.collection('messageboards').findOne({board: boardName})
  } catch(e) {
    handleError(req, res, "error finding board " + boardName, e)
    return
  }
  
  //board not found in db
  if (dbBoard == null){
    handleError(req, res, "The board \"" + boardName + "\" does not exist, so your reply has not been posted.", undefined)
    return
  }
  
  //board found in db, check if thread's _id is valid (conditional for not valid)
  if (!ObjectID.isValid(req.body.thread_id)) {
    handleError(req, res, "An improper thread id was supplied: " + req.body.thread_id + ". Please specify a proper thread id.", undefined)
    return
  }
  
  //_id is valid, attempt to find thread with _id (conditional for not found)
  let foundThread = dbBoard.threads.find(thread => thread._id == req.body.thread_id)
  
  if (!foundThread){
    handleError(req, res, "A thread with the given id: " + req.body.thread_id + " could not be found.", undefined)
    return
  }
  
  //thread found, update thread with new reply and bumped on time
  let bumped_time = new Date().toISOString()

  let newReply = {
    _id: new ObjectID(),
    text: req.body.text,
    created_on: bumped_time,
    delete_password: req.body.delete_password,
    reported: false
  }
  
  let returnResult
  try {
    returnResult = await db.collection('messageboards').findOneAndUpdate(
      {board: boardName, "threads._id": ObjectID.createFromHexString(req.body.thread_id)},
      {$set: {"threads.$.bumped_on": bumped_time, "threads.$.replies": [newReply].concat(foundThread.replies), "threads.$.replycount": (foundThread.replycount + 1)}},
      {returnOriginal: false}
    )} catch(e) {
    handleError(req, res, "error updating board \"" + boardName + "\" with new thread reply", e)
    return
  }
  
  //Check if update was succesful
  if (returnResult.value == null){
    handleError(req, res, "reply not succesfully added to board", undefined)
    return
  }
  
  console.log('succesfully added reply!')
  res.redirect('/b/' + boardName + '/' + req.body.thread_id)
  return
})
  
app.route('/api/replies/:board').get(async function (req, res)
{
  //ajax data sent as query if ajax specified "GET"
  let thread_id = req.query.thread_id
  let boardName = req.params.board
  
  //attempt to find the thread. The projection causes the board object to return with only the thread we are looking for.
  let thread = null
  try {
    thread = await db.collection('messageboards').findOne({board: boardName, "threads._id": ObjectID.createFromHexString(thread_id)}, {projection:{"threads.$": 1}})
    thread = thread.threads[0]
  } catch(e) {
    handleError(req, res, "error finding thread with id: " + thread_id, e)
    return
  }
  
  if (thread == null){
    handleError(req, res, "the thread with id \"" + thread_id + "\" couldn't be found for the GET thread.html redirect. If the url was manually input, the thread may not exist, otherwise something is wrong.", undefined)
    return
  }
  
  //handle removal of data that should not be sent
  delete thread.delete_password;
  delete thread.reported;
  thread.replies.forEach(reply => {delete reply.delete_password; delete reply.reported})
  
  res.send(thread)
  return
})
  
//body: board, thread_id, reply_id, delete_password
app.route('/api/replies/:board').delete(async function (req, res){
  let boardName = req.params.board
  let thread_id = req.body.thread_id
  let reply_id = req.body.reply_id
  let delete_password = req.body.delete_password
  
  if (!ObjectID.isValid(thread_id) || !ObjectID.isValid(reply_id)){
    console.log("invalid _id's: " + thread_id + " " + reply_id)
    res.send("incorrect password")
    return
  }
  
  thread_id = ObjectID.createFromHexString(thread_id)
  reply_id = ObjectID.createFromHexString(reply_id)
  
//Attempt to remove reply. If anything is wrong (wrong _id or p/w) but doesn't cause an error, then the reply will not be found and result.value will be null. Otherwise it should work. Array filter options along with the filtered positional operator are used here.
  let result = null
  try {
    result = await db.collection('messageboards').findOneAndUpdate(
      //I could just do "threads.replies._id" and leave out board and "threads._id", but there could be future cases where the value would be incorrectly matched multiple times by only looking to the final nest and not checking the previous nest filters as well.
      {board: boardName, "threads._id": thread_id, "threads.replies._id": reply_id},
      {$set: {"threads.$[threadMatch].replies.$[replyMatch].text":"[deleted]"}},
      {
        returnOriginal: false, 
        arrayFilters:[{"threadMatch._id":thread_id}, {"replyMatch._id":reply_id}]
      }
    )
  } catch(e) {
    handleError(req, res, "error updating board " + boardName + " to remove reply: " + reply_id, e)
    return
  }
  
  if (result.value == null){
    res.send("incorrect password")
    return
  }
  
  console.log('succesfully updated board ' + boardName + ' to remove reply: ' + reply_id)
  res.send('success')
  return
})
  
app.route('/api/replies/:board').put(async function (req, res){
  let boardName = req.params.board
  let thread_id = req.body.thread_id
  let reply_id = req.body.reply_id
  
  if (!ObjectID.isValid(thread_id) || !ObjectID.isValid(reply_id)){
    console.log("invalid _id(s): " + thread_id + " " + reply_id)
    res.send("incorrect password")
    return
  }
  
  thread_id = ObjectID.createFromHexString(thread_id)
  reply_id = ObjectID.createFromHexString(reply_id)
  let result = null
  try {
    result = await db.collection('messageboards').findOneAndUpdate(
      {board:boardName, "threads._id": thread_id, "threads.replies._id": reply_id},
      {$set: {"threads.$[threadMatch].replies.$[replyMatch].reported": true}},
      {
        returnOriginal: false,
        arrayFilters:[{"threadMatch._id":thread_id}, {"replyMatch._id":reply_id}]
      }
    )
  } catch(e) {
    handleError(req, res, "error reporting reply " + reply_id, e)
    return
  }
  
  if (result.value == null){
    console.log("board: " + boardName + " with thread: " + thread_id + " and reply: " + reply_id + " could not be found to report reply") 
    res.send("incorrect password")
    return
  }
  
  console.log('succesfully reported reply ' + reply_id)
  res.send("success")
  return
})

app.get("/error", (req, res)=>{
  let fullMessage = ""
  req.query.myMessage === undefined ? fullMessage += "There's a bug: no personal message sent" : fullMessage += req.query.myMessage
  fullMessage += "<br/><br/>"
  req.query.error === undefined ? fullMessage += "no code error thrown" : fullMessage += req.query.error
  
  res.send(fullMessage)
})

};//export end
