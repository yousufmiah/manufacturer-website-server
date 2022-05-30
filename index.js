const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: Stripe } = require("stripe");
const { resetWatchers } = require("nodemon/lib/monitor/watch");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

    const usersToCollection = client
      .db("tools_manufacturer")
      .collection("usersto");

    //ordersCollection==========
    const ordersCollection = client
      .db("tools_manufacturer")
      .collection("orders");

    //reviewCollection==========
    const reviewCollection = client
      .db("tools_manufacturer")
      .collection("review");

    //payment collection=================
    const paymentCollection = client
      .db("tools_manufacturer")
      .collection("payments");

    //stripe payment=========
    app.post("/create-payment-intents", async (req, res) => {
      const order = req.body;
      const price = order.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // //=for payment for order==========
    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const order = await ordersCollection.findOne(query);
      res.send(order);
    });

    //+++++++++++++++++++++
    //patch for stripe payment update ===========
    app.patch("/order/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: id };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(updatedOrder);
    });
    //+++++++++++++++++++++

    // get all items from database========================
    app.get("/items", async (req, res) => {
      // console.log(req.query);
      const query = {};
      const cursor = itemsCollection.find(query);
      const items = await cursor.toArray();
      res.send(items);
    });

    // POST item add new data=======
    app.post("/items", async (req, res) => {
      const newOrder = req.body;
      const result = await itemsCollection.insertOne(newOrder);
      res.send(result);
    });

    // delete items from main data======
    app.delete("/d-items/:id", async (req, res) => {
      // console.log(req.params);
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      // console.log("query", query);
      const result = await itemsCollection.deleteOne(query);
      res.send(result);
    });

    // post Order API data
    app.post("/orders-item/:email", async (req, res) => {
      const newOrder = req.body;
      const email = req.params.email;
      const exist = await ordersCollection.findOne({
        email: email,
        name: newOrder.name,
      });
      if (exist) {
        res.send({ success: "Already exist" });
      } else {
        const result = await ordersCollection.insertOne(newOrder);
        res.send({ success: "Order added success" });
      }
    });

    // get items from order data========================
    app.get("/get-orders-items/:email", async (req, res) => {
      // console.log(req.query);
      const email = req.params.email;
      const cursor = ordersCollection.find({ email });
      const items = await cursor.toArray();
      res.send(items);
    });

    // get all items from order data======================
    app.get("/get-orders", async (req, res) => {
      // console.log(req.query);
      const cursor = ordersCollection.find();
      const items = await cursor.toArray();
      res.send(items);
    });

    // delete items from order
    app.delete("/d-order-items/:id", async (req, res) => {
      // console.log(req.params);
      const id = req.params.id;
      const query = { _id: id };
      // console.log("query", query);
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // verify Admin =================
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await usersToCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    //get all for useAdmin=========
    app.get("/user-t", async (req, res) => {
      const users = await usersToCollection.find().toArray();
      res.send(users);
    });

    // admin require for useAdmin==========
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersToCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // put users to admin--------------------
    app.put(
      "/user-t/admin/:email",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        // console.log(req);
        const email = req.params.email;
        const requester = req.decoded.email;
        const requesterAccount = await usersToCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: email };
          const updateDoc = {
            $set: { role: "admin" },
          };
          const result = await usersToCollection.updateOne(filter, updateDoc);
          res.send(result);
        } else {
          res.status(403).send({ message: "forbidden" });
        }
      }
    );

    // put users to userto collection--------------------
    app.put("/user-t/:email", async (req, res) => {
      // console.log(req);
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersToCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
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
