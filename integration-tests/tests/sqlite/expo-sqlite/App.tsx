// This file serves only as a reference for what and how I'm testing in a detached project.
// @ts-expect-error
import { StatusBar } from 'expo-status-bar';
// @ts-expect-error
import { useEffect, useState } from 'react';
// @ts-expect-error
import { StyleSheet, Text, View } from 'react-native';
import { allDataTypesSqlStreamTest, allDataTypesSqlValuesTest, allDataTypesUnsafeTest, embedingSQLQueryAndSQLTemplateTest, loggerTest, sqlQueryApiTest } from './tests.ts';
import * as SQLite from 'expo-sqlite';
import { waddler } from 'waddler/expo-sqlite';

const client = SQLite.openDatabaseSync('inMemoryDb', {}, ':memory:');
const sql = waddler({client});

export default function App() {
  const [items, setItems] = useState<number>(0);
  const tests = [allDataTypesUnsafeTest,allDataTypesSqlValuesTest,allDataTypesSqlStreamTest, sqlQueryApiTest, embedingSQLQueryAndSQLTemplateTest];

  useEffect(() => {
    (async () => {
      let passed = 0;
      try{
        for (const test of tests) {
          await test(sql);
          passed += 1;
        }

        await loggerTest(client);
        passed += 1;
      
      }catch (error) {
        console.error((error as Error).name);
        console.error((error as Error).message);
        console.error((error as Error).cause);
        console.error((error as Error).stack);
      }

      setItems(passed)
    })()
  })

  return (
    <View style={styles.container}>
      <Text>Tests	{tests.length + 1 - items} failed | {items} passed ({tests.length + 1}){}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
