# MongoDB Atlas Connection Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a cluster (if you don't have one).
2. In the Atlas dashboard, click on your cluster, then click "Connect" > "Connect your application".
3. Copy the connection string. It will look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority
   ```
4. Replace `<username>`, `<password>`, and `<dbname>` with your actual credentials and database name.
5. Open the `.env` file in the `backend` folder and paste your connection string:
   ```
   MONGODB_URI=your_full_connection_string_here
   ```
6. Save the file. Your backend will now connect to MongoDB Atlas when started.

**Note:** Never commit your real credentials to version control.
