// This file serves only as a reference for what and how I'm testing in a detached project.
import './global.js';
// @ts-expect-error
import { StatusBar } from 'expo-status-bar';
// @ts-expect-error
import { useEffect, useState } from 'react';
// @ts-expect-error
import { open } from '@op-engineering/op-sqlite';
import { StyleSheet, Text, View } from 'react-native';
import { waddler } from 'waddler/op-sqlite';
import { allDataTypesSqlValuesTest, allDataTypesUnsafeTest } from './tests.ts';

const client = open({
	name: 'inMemoryDb',
	location: ':memory:',
});
const sql = waddler({ client });

export default function App() {
	const [items, setItems] = useState<number>(0);
	const tests = [allDataTypesUnsafeTest, allDataTypesSqlValuesTest];

	useEffect(() => {
		(async () => {
			let passed = 0;
			try {
				for (const test of tests) {
					await test(sql);
					passed += 1;
				}
			} catch (error) {
				console.error((error as Error).name);
				console.error((error as Error).message);
				console.error((error as Error).cause);
				console.error((error as Error).stack);
			}

			setItems(passed);
		})();
	});

	return (
		// @ts-expect-error
		<View style={styles.container}>
			<Text>Tests{tests.length - items} failed | {items} passed ({tests.length}){}</Text>
			<StatusBar style='auto' />
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
