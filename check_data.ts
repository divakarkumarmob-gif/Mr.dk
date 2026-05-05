import { getCountFromServer, collection } from 'firebase/firestore';
import { db } from './src/lib/firebase';

async function check() {
  const coll = collection(db, 'questions');
  const snapshot = await getCountFromServer(coll);
  console.log('Count:', snapshot.data().count);
}
check();
