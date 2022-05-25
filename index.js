const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(cors());
app.use(express.json());

//connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.asff6.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// // verifyJWT secret=================
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

// ==========================
async function run() {
  try {
    await client.connect();

    //itemsCollection=============
    const itemsCollection = client.db("tools_manufacturer").collection("items");

    //ordersCollection==========
    const ordersCollection = client
      .db("tools_manufacturer")
      .collection("orders");

    //reviewCollection==========
    const reviewCollection = client
      .db("tools_manufacturer")
      .collection("review");

    // get all items from database========================
    app.get("/items", async (req, res) => {
      // console.log(req.query);
      const query = {};
      const cursor = itemsCollection.find(query);
      const items = await cursor.toArray();
      res.send(items);
    });

    // delete items from order
    app.delete("/d-items/:id", async (req, res) => {
      // console.log(req.params);
      const id = req.params.id;
      const query = { _id: id };
      // console.log("query", query);
      const result = await itemsCollection.deleteOne(query);
      res.send(result);
    });

    // POST Order API
    app.post("/orders-item", async (req, res) => {
      const newOrder = req.body;
      const result = await ordersCollection.insertOne(newOrder);
      res.send(result);
    });

    // get items from order========================
    app.get("/get-orders-items", async (req, res) => {
      // console.log(req.query);
      const query = {};
      const cursor = ordersCollection.find(query);
      const items = await cursor.toArray();
      res.send(items);
    });

    // delete items from order
    app.delete("/d-order-items/:id", async (req, res) => {
      // console.log(req.params);
      const id = req.params.id;
      const query = { _id: id };
      console.log("query", query);
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // Post review api
    app.post("/review", async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });

    // get reviews========================
    app.get("/reviews", async (req, res) => {
      // console.log(req.query);
      const query = {};
      const cursor = reviewCollection.find(query);
      const items = await cursor.toArray();
      res.send(items);
    });

    // Count Reviews
    app.get("/reviewCount", async (req, res) => {
      const count = await reviewCollection.estimatedDocumentCount();
      res.send({ count });
    });
  } finally {
  }
}
run().catch(console.dir);

console.log("all route ok");

//root api
app.get("/", (req, res) => {
  res.send("Running Tools manufacturer Server.");
});

//heroku
app.get("/hero", (req, res) => {
  res.send("Meet with heroku");
});

app.listen(port, () => {
  console.log("Tools manufacturer Listening to port", port);
});
