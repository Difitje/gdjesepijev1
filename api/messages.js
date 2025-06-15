// api/messages.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb');

module.exports = withAuth(async (req, res) => {
  const { db } = await connectToDatabase();
  const messagesCollection = db.collection('messages');
  const userId = req.user.userId; // Trenutno prijavljen korisnik (string)

  if (req.method === 'GET') {
    try {
      const rawMessages = await messagesCollection.find({
        $or: [{ senderId: userId }, { receiverId: userId }]
      }).sort({ createdAt: 1 }).toArray();

      const groupedMessages = {};
      rawMessages.forEach(msg => {
          const chatPartners = [msg.senderId, msg.receiverId].sort();
          const chatKey = `${chatPartners[0]}-${chatPartners[1]}`;
          if (!groupedMessages[chatKey]) {
              groupedMessages[chatKey] = [];
          }
          groupedMessages[chatKey].push({
              autorId: msg.senderId,
              tekst: msg.content,
              time: msg.createdAt,
              isRead: msg.isRead || false,
              messageId: msg._id.toString()
          });
      });

      res.status(200).json(groupedMessages);

    } catch (error) {
      console.error('Greška pri dohvaćanju poruka:', error);
      res.status(500).json({ message: 'Greška servera pri dohvaćanju poruka.', error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { receiverId, content } = req.body;
      const senderId = userId;

      if (!receiverId || !content) {
        return res.status(400).json({ message: 'Primatelj i sadržaj poruke su obavezni.' });
      }

      const newMessage = {
        senderId: senderId,
        receiverId: receiverId,
        content: content,
        createdAt: new Date().toISOString(),
        isRead: false
      };

      const result = await messagesCollection.insertOne(newMessage);
      res.status(201).json({ message: 'Poruka uspješno poslana!', messageId: result.insertedId });

    } catch (error) {
      console.error('Greška pri slanju poruke:', error);
      res.status(500).json({ message: 'Greška servera pri slanju poruke.', error: error.message });
    }
  } else if (req.method === 'PUT') {
      try {
          const { chatKey } = req.body;
          if (!chatKey) {
              return res.status(400).json({ message: 'Chat ključ je obavezan za ažuriranje.' });
          }

          const [id1, id2] = chatKey.split('-');
          const partnerId = id1 === userId ? id2 : id1;

          await messagesCollection.updateMany(
              { senderId: partnerId, receiverId: userId, isRead: false },
              { $set: { isRead: true } }
          );

          res.status(200).json({ message: 'Poruke uspješno označene kao pročitane.' });

      } catch (error) {
          console.error('Greška pri označavanju poruka kao pročitanih:', error);
          res.status(500).json({ message: 'Greška servera pri ažuriranju poruka.', error: error.message });
      }
  }
  else {
    res.status(405).json({ message: 'Metoda nije dozvoljena.' });
  }
});