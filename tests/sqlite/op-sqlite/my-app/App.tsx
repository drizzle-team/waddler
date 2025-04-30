import { open } from '@op-engineering/op-sqlite';
import { waddler } from 'waddler/op-sqlite'
import {  Text, View } from 'react-native';
import { useEffect, useState } from 'react';

const client = open({
    name: 'inMemoryDb',
    location: ':memory:',
});

const sql = waddler({ client });

export default function App() {
  const [items, setItems] = useState<any>(null);
  useEffect(() => {

    (async () => {
      await sql.unsafe('create table if not exists users (id integer);')
      await sql.unsafe('insert into users values (?)', [1]);
      const rows = await sql.unsafe('select from users;', [], {rowMode: 'object'}) as {id:number}[];
      setItems(rows);
    })();
  }, []);
  
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
      }}
    >
      {items.map((item: {id: number}) => (
       <Text key={item.id}>{item.id}</Text>
      ))}
    </View>
  );
}
