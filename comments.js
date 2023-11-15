// Create web server 
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { randomBytes } = require('crypto'); // generate random id
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const commentsByPostId = {};

app.get('/posts/:id/comments', (req, res) => {
  res.send(commentsByPostId[req.params.id] || []); // return empty array if no comments
});

app.post('/posts/:id/comments', async (req, res) => {
  const commentId = randomBytes(4).toString('hex'); // generate random id
  const { content } = req.body; // get comment from request body

  const comments = commentsByPostId[req.params.id] || []; // get comments for this post
  comments.push({ id: commentId, content, status: 'pending' }); // add new comment to array
  commentsByPostId[req.params.id] = comments; // update comments for this post

  await axios.post('http://event-bus-srv:4005/events', { // post event to event bus
    type: 'CommentCreated',
    data: {
      id: commentId,
      content,
      postId: req.params.id,
      status: 'pending'
    }
  })

  res.status(201).send(comments); // send back all comments for this post
});

app.post('/events', async (req, res) => {
  console.log('Received Event', req.body.type); // log event type

  const { type, data } = req.body; // get event type and data

  if (type === 'CommentModerated') { // if comment moderated
    const { postId, id, status, content } = data; // get comment data

    const comments = commentsByPostId[postId]; // get comments for this post
    const comment = comments.find(comment => { // find comment with this id
      return comment.id === id;
    });
    comment.status = status; // update status

    await axios.post('http://event-bus-srv:4005/events', { // post event to event bus
      type: 'CommentUpdated',
      data: {
        id,
        status,
        postId,
        content
      }
    });
  }

  res.send({});
});

app