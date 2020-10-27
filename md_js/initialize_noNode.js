// Last Update: Oct 26, 2020
// © Dimitris Papanikolaou

// This version uses D3.js version d3.v3.js
// Combined trips must be computed beforehand and not as part of initialize.
// trips: array of trip JSON objects. Each trip JSON object consists of the following attributes:
// trip = {
// 	id : integer,
// 	duration : integer (seconds),
// 	start_date : Date object,
// 	end_date : Date object,
// 	start_station : String or integer,
// 	start_station_name : String,
// 	start_station_lat : number,
// 	start_station_lng : number,
// 	end_station : String or integer,
// 	end_station_name : String,
// 	end_station_lat : number,
// 	end_station_lng : number,
// 	bikeid : String,
// 	trip_id : String,
// 	type : "full"
// }


/***	GLOBAL VARIABLES	 ***/
/***	GLOBAL VARIABLES	 ***/

var timeFormat = d3.time.format("%H:%M:%S");
var dateFormat = d3.time.format("%m/%d/%Y");
var dateTimeFormat = d3.time.format("%m/%d/%y %H:%M");

var startDate = d3.time.format("%Y-%m-%d").parse("2019-06-17");
var endDate = d3.time.format("%Y-%m-%d").parse("2019-06-18");
var timerange = d3.time.minutes(startDate, endDate, 15);

var startComputingTime = Date.now();
var data = md.getDynamics(trips,timeRange);
console.log("Total computing time: " + (Date.now() - startComputingTime)/1000 + "seconds" );
