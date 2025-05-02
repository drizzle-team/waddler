export const dropAllDataTypesTable = async (dsn: string, tlsSecurity: string) => {
	await $`gel query "DROP TYPE default::all_data_types;" --tls-security=${tlsSecurity} --dsn=${dsn}`;
};

export const createAllDataTypesTable = async (dsn: string, tlsSecurity: string) => {
	await $`gel query "CREATE TYPE default::all_data_types {
        create property stringColumn:str;
        create property boolColumn:bool;
        create property int16Column:int16;
        create property int32Column:int32;
        create property int64Column:int64;
        create property float32Column:float32;
        create property float64Column:float64;
        create property bigintColumn:bigint;
        create property decimalColumn:decimal;
        create property uuidColumn:uuid;
        create property jsonColumn:json;
        create property datetimeColumn:datetime;
        create property local_datetimeColumn:cal::local_datetime;
        create property local_dateColumn:cal::local_date;
        create property local_timeColumn:cal::local_time;
        create property durationColumn:duration;
        create property relative_durationColumn:cal::relative_duration;
        create property dateDurationColumn:cal::date_duration;
        create property bytesColumn:bytes;
        create property defaultValue:int32{SET default := ${defaultValue}};
};" --tls-security=${tlsSecurity} --dsn=${dsn}`;
};

export const dropAllArrayDataTypesTable = async (dsn: string, tlsSecurity: string) => {
	await $`gel query "DROP TYPE default::all_array_data_types;" --tls-security=${tlsSecurity} --dsn=${dsn}`;
};

export const createAllArrayDataTypesTable = async (dsn: string, tlsSecurity: string) => {
	await $`gel query "CREATE TYPE default::all_array_data_types {
                create property stringArrayColumn:array<str>;
                create property boolArrayColumn:array<bool>;
                create property int16ArrayColumn:array<int16>;
                create property int32ArrayColumn:array<int32>;
                create property int64ArrayColumn:array<int64>;
                create property float32ArrayColumn:array<float32>;
                create property float64ArrayColumn:array<float64>;
                create property bigintArrayColumn:array<bigint>;
                create property decimalArrayColumn:array<decimal>;
                create property uuidArrayColumn:array<uuid>;
                create property jsonArrayColumn:array<json>;
                create property datetimeArrayColumn:array<datetime>;
                create property local_datetimeArrayColumn:array<cal::local_datetime>;
                create property local_dateArrayColumn:array<cal::local_date>;
                create property local_timeArrayColumn:array<cal::local_time>;
                create property durationArrayColumn:array<duration>;
                create property relative_durationArrayColumn:array<cal::relative_duration>;
                create property dateDurationArrayColumn:array<cal::date_duration>;
                create property bytesArrayColumn:array<bytes>;
        };" --tls-security=${tlsSecurity} --dsn=${dsn}`;
};

export const dropAllNdarrayDataTypesTable = async (dsn: string, tlsSecurity: string) => {
	await $`gel query "DROP TYPE default::all_nd_array_data_types;" --tls-security=${tlsSecurity} --dsn=${dsn}`;
};

export const createAllNdarrayDataTypesTable = async (dsn: string, tlsSecurity: string) => {
	await $`gel query "CREATE TYPE default::all_nd_array_data_types {
                create property stringNdArrayColumn:array<array<str>>;
                create property boolNdArrayColumn:array<array<bool>>;
                create property int16NdArrayColumn:array<array<int16>>;
                create property int32NdArrayColumn:array<array<int32>>;
                create property int64NdArrayColumn:array<array<int64>>;
                create property float32NdArrayColumn:array<array<float32>>;
                create property float64NdArrayColumn:array<array<float64>>;
                create property bigintNdArrayColumn:array<array<bigint>>;
                create property decimalNdArrayColumn:array<array<decimal>>;
                create property uuidNdArrayColumn:array<array<uuid>>;
                create property jsonNdArrayColumn:array<array<json>>;
                create property datetimeNdArrayColumn:array<array<datetime>>;
                create property local_datetimeNdArrayColumn:array<array<cal::local_datetime>>;
                create property local_dateNdArrayColumn:array<array<cal::local_date>>;
                create property local_timeNdArrayColumn:array<array<cal::local_time>>;
                create property durationNdArrayColumn:array<array<duration>>;
                create property relative_durationNdArrayColumn:array<array<cal::relative_duration>>;
                create property dateDurationNdArrayColumn:array<array<cal::date_duration>>;
                create property bytesNdArrayColumn:array<array<bytes>>;
        };" --tls-security=${tlsSecurity} --dsn=${dsn}`;
};

export const defaultValue = 3;
