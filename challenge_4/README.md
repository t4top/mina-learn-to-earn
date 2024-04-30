# Learn-to-earn Challenge 4

## How to build and test

```sh
npm install
npm run test
```

## Challenge Question

### Background

For this challenge you need to further develop the application you created for Challenge 3.
We want to make the system more private by allowing private messages.

1. Change your application so that messages and their verification are private.

2. The highest message number per agent can be public

3. We want to extend the state stored to also include the following fields.

   1. Current block height
   2. Transaction sender
   3. Sender's nonce

   Use inheritance to extend your existing method that stores state.

4. We also want to query the state.

Write a test to get the details (as above) for a particular block height.

## Deliverables

1. An app chain extending the functionality from Challenge 3.
2. A means to keep messages private
3. Tests for the chain to demonstrate the new functionality
