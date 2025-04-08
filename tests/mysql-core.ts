import type { SQL } from '~/sql';

export const createAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe(`
			    CREATE TABLE \`all_data_types\` (
				\`integer\` int,
				\`tinyint\` tinyint,
				\`smallint\` smallint,
				\`mediumint\` mediumint,
				\`bigint\` bigint,
				\`real\` real,
				\`decimal\` decimal(4,2),
				\`double\` double,
				\`float\` float,
				\`serial\` serial AUTO_INCREMENT,
				\`binary\` binary(6),
				\`varbinary\` varbinary(6),
				\`char\` char(255),
				\`varchar\` varchar(256),
				\`text\` text,
				\`boolean\` boolean,
				\`date\` date,
				\`datetime\` datetime,
				\`time\` time,
				\`year\` year,
				\`timestamp\` timestamp,
				\`json\` json,
				\`popularity\` enum('unknown','known','popular'),
                \`default\` int default 3
			);
		`);
};

export const dropAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_data_types;');
};

export const defaultValue = 3;
