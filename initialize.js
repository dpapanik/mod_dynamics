// Last Update: Oct 26, 2020
// © Dimitris Papanikolaou


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
/***	GLOBAL VARIABLES	 ***/

let express = require('express');
let app = express();
global.fetch = require("node-fetch");
let d3 = require("d3");
let csv=require('csvtojson');
var expectation_maximization = require('./expectation-maximization_modified');
let md = require('./mobility_dynamics');

app.set('view engine', 'ejs');
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use('/data', express.static('data'));

var bluebikesFilePath = "data/bluebikes/201906-bluebikes.tripdata.csv";
var cabiFilePath = "data/cabi/201906-capitalbikeshare-tripdata.csv";
var divvyFilePath = "data/divvy/201906-divvy.tripdata.csv";
var citibikeFilePath = "data/citibike/201906-citibike-tripdata.csv";

var csvFilePath = cabiFilePath;

var outPutFilePath;
var systemName;

if (csvFilePath==bluebikesFilePath){
	outPutFilePath = "bluebikes_201906";
	systemName = "Blue";
}
if (csvFilePath==cabiFilePath){
	outPutFilePath = "cabi_201906";
	systemName = "CaBi";
}
if (csvFilePath==divvyFilePath){
	outPutFilePath = "divvy_201906";
	systemName = "Divvy";
}
if (csvFilePath==citibikeFilePath){
	outPutFilePath = "citibike_201906";
	systemName = "Citi";
}

var parseTime = d3.timeParse("%Y-%m-%d");
var formatTime = d3.timeFormat("%Y-%m-%d");
var formatDay = d3.timeFormat("%a");
var startDate = parseTime("2019-06-17");
var endDate = parseTime("2019-06-18");
var timeStep = 15;
var timeRange = d3.timeMinutes(startDate, endDate, timeStep);



csv() // csv() returns a promise
	.fromFile(csvFilePath)
	.then(function(tripData){
	var startComputingTime = Date.now();
	var trips = [];
	tripData.forEach(function(d) {
		var trip={};
		if (csvFilePath==bluebikesFilePath){
			trip.duration = +d["tripduration"];
			var parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
			trip.start_date = parseTime(d["starttime"].slice(0,-5));
			trip.end_date = parseTime(d["stoptime"].slice(0,-5));

			trip.start_station = +d["start station id"];
			trip.start_station_name = d["start station name"];

			trip.start_station_lat = +d["start station latitude"];
			trip.start_station_lng = +d["start station longitude"];

			trip.end_station = +d["end station id"];
			trip.end_station_name = d["end station name"];

			trip.end_station_lat = +d["end station latitude"];
			trip.end_station_lng = +d["end station longitude"];

			trip.bikeid = d["bikeid"];
			trip.trip_id = d[""];
			trip.type = "full";
		}
		if (csvFilePath==cabiFilePath){
			trip.duration = +d["Duration"];
			var parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
			trip.start_date = parseTime(d["Start date"]);
			trip.end_date = parseTime(d["End date"]);

			trip.start_station = +d["Start station number"];
			trip.start_station_name = d["Start station number"];

			trip.start_station_lat = +d[""];
			trip.start_station_lng = +d[""];

			trip.end_station = +d["End station number"];
			trip.end_station_name = d["End station number"];

			trip.end_station_lat = +d[""];
			trip.end_station_lng = +d[""];

			trip.bikeid = d["Bike number"];
			trip.trip_id = d[""];
			trip.type = "full";
		}
		if (csvFilePath==citibikeFilePath){
			trip.duration = +d["tripduration"];
			var parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
			trip.start_date = parseTime(d["starttime"].slice(0,-5));
			trip.end_date = parseTime(d["stoptime"].slice(0,-5));

			trip.start_station = +d["start station id"];
			trip.start_station_name = d["start station name"];

			trip.start_station_lat = +d["start station latitude"];
			trip.start_station_lng = +d["start station longitude"];

			trip.end_station = +d["end station id"];
			trip.end_station_name = d["end station name"];

			trip.end_station_lat = +d["end station latitude"];
			trip.end_station_lng = +d["end station longitude"];

			trip.bikeid = d["bikeid"];
			trip.trip_id = d[""];
			trip.type = "full";
		}
		if (csvFilePath==divvyFilePath){
			trip.duration = +d["Duration"];
			var parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
			trip.start_date = parseTime(d["Start Time"]);
			trip.end_date = parseTime(d["End Time"]);

			trip.start_station = +d["Start Station ID"];
			trip.start_station_name = d["Start Station Name"];

			trip.start_station_lat = +d[""];
			trip.start_station_lng = +d[""];

			trip.end_station = +d["End Station ID"];
			trip.end_station_name = d["End Station Name"];

			trip.end_station_lat = +d[""];
			trip.end_station_lng = +d[""];

			trip.bikeid = d["Bike ID"];
			trip.trip_id = d["Rental ID"];
			trip.type = "full";
		}
		trips.push(trip);
	});

	trips = trips
		.filter(function(d){
			return !(d.start_station_lat==0 || d.start_station_lng==0 || d.end_station_lat==0 || d.end_station_lng==0 || d.start_station==0 || d.end_station==0 || d.duration==0)
		})
		.sort(function(a,b){return a.start_date-b.start_date});

	var avg_trip_duration = d3.mean(trips, function(d){return d.duration});
	// trips = add_empty_trips_v3(trips, avg_trip_duration);

	var data = getDataPerDay(trips, startDate, endDate);
	var records = getRecordsFromData(data);
	exportCSV(records, outPutFilePath);

	app.get('/', function(req, res){
		res.render('index', {mydata: JSON.stringify(myData)});
	  // res.sendFile(__dirname + '/cabi_dynamics.html');
	});

	app.listen(3000);
	console.log('listening to port 3000...');
	console.log("Total computing time: " + (Date.now() - startComputingTime)/1000 + "seconds" );
});

function getTripsPerDay(trips, startDate, endDate){
	var result = [];
	var datesRange = d3.timeDay.range(startDate, endDate);
	datesRange.forEach(function(date, i){
		var nextDate = new Date(date.getTime()+ 1000 * 60 * 60 * 24);
		var dateTrips = trips.filter(function(d){
			return (d.end_date >= date && d.end_date < nextDate) || (d.start_date >= date && d.start_date < nextDate );
		});
		result.push(dateTrips);
	});
	return result;
}
function getDataPerDay(trips, startDate, endDate, timeStep){
	var result = [];
	var datesRange = d3.timeDay.range(startDate, endDate);
	datesRange.forEach(function(date, i){
		var nextDate = new Date(date.getTime()+ 1000 * 60 * 60 * 24);
		var minutesRange = d3.timeMinutes(date, nextDate, timeStep);
		var dateTrips = trips.filter(function(d){
			return (d.end_date >= date && d.end_date < nextDate) || (d.start_date >= date && d.start_date < nextDate );
		});
		var dateData = getDynamics(dateTrips,minutesRange);
		result.push(dateData);
	});
	return result;
}
function getDynamics(trips,timeRange){
	var stocksAndVehicles = md.getStocksAndVehicles(trips, timeRange);
	var stocks = stocksAndVehicles.stocks;
	var vehicles = stocksAndVehicles.vehicles;

	var bundledTrips = md.getBundledTrips(stocks, trips, timeRange);

	var flowRates = md.getFlowRates(bundledTrips);
	var seasonalFlowRates = md.getSeasonalFlowRates(flowRates);
	var trendFlowRates = md.getTrendFlowRates(flowRates);

	var levels = md.getLevels(flowRates);
	var seasonalLevels = md.getLevels(seasonalFlowRates);
	var trendLevels = md.getLevels(trendFlowRates);

	md.setDomains(levels);
	md.setDomains(seasonalLevels);
	md.setDomains(trendLevels);

	md.addStats(stocks);

	stocks.sort(md.sortC); //.sort(sortA)
	// d3.shuffle(stocks);

	return {
		stocks: levels,
		seasonalStocks: seasonalLevels,
		trendStocks: trendLevels,
		trips: trips,
		vehicles: vehicles
	};
}
function getRecordsFromData(dataPerDay){
	var result = [];
	dataPerDay.forEach(function(dateData){
		result.push(getRecords(dateData));
	});
	return result;
}
function getRecords(stocks){

	/***** Avg. Departure Variance *****/
	var avgDepVar = d3.mean(stocks.filter(function(d){return d.type=="station"}), function(d){
		return Math.pow(d.stats.outFlows_full_T-stocks[0].stats.inFlows_full_T,2)
	});

	/***** Avg. Departure Standard Deviation *****/
	var avgDepStD = Math.sqrt(avgDepVar);

	/***** Avg. Departures-Arrivals Distance *****/
	var avgDepArrDist =(function(){
		return d3.mean(stocks.filter(function(d){return d.type=="station"}), function(d){
			return Math.abs(d.stats.inFlows_full_T-d.stats.outFlows_full_T);
		});
	})();

	/***** System Trend *****/
	var systemTrend =(function(){
		/*
		Correct way to define trend at the system level:
		1. get sum of net inflows (or net outflows) from all stocks (including stocks "in-transit" and "dispatched")
		2. divide it with sum of inflows (or outflows) from all stocks (including stocks "in-transit" and "dispatched")
		Note: Since you consider ALL stocks, the sum of inflows will equal the sum of outflows (note that this is not the case if you consider only station stocks)
		Example: If system trend is 1 (or 100%) it means that all trips that happend were one-way and contributed to imbalancing the system
		Example: If system trend is 0.5 (or 50%) it means that half of the trips that happend were one-way and the other half were round-trips
		Example: If system trend is 0 (or 0%) it means that no trips that happend were one-way; instead, all trips that happened were round-trips
		*/
		var systemNetInFlows = d3.sum(stocks, function(d){return Math.max(d.stats.inFlows_full_sum-d.stats.outFlows_full_sum,0)});
		var systemInflows = d3.sum(stocks, function(d){return d.stats.inFlows_full_sum});
		return systemNetInFlows/systemInflows;
	})();

	/***** Vehicle Hours Traveled *****/
	var VHT = d3.sum(stocks[0].values, function(d){return d.level});

	/***** Vehicle Hours Dispatched *****/
	var VHD = d3.sum(stocks[1].values, function(d){return d.level});

	/***** Vehicle Hours Parked *****/
	var VHP = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d3.sum(d.values, function(d){return d.level}) });

	/*
	Note:
	VHPmin, VHPmarginal, VHPseasonal, VHPtrend, VHTseasonal, and VHTtrend, must be calculated by obtaining records from each each system stocks separately.
	*/

	/***** Delta Vehicle Hours *****/
	var deltaVH = d3.sum(stocks, function(d){
		return d.stats.occupancy_positive;
	});
	// var deltaVHP = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d3.sum(d.values, function(v){return Math.max(0,v.levelMarginal - d.values[0].levelMarginal)}) });
	// var deltaVH = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d3.sum(d.values, function(v){return Math.min(0,v.levelMarginal - d.values[0].levelMarginal)}) });

	/***** Mean Absolute Deviation of Occupancies *****/
	var meanAbsDevOccup = d3.sum(stocks, function(d){
		return Math.abs(d.stats.occupancy);
	});
	// var meanAbsDevOccup = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
	// 	var meanStationsOccup = (stocks[0].stats.occupancy + stocks[1].stats.occupancy)/2;
	// 	return Math.abs(d.stats.occupancy-meanStationsOccup);
	// });



	/***** Occupancies Variance *****/
	var occupVar = d3.variance(stocks.filter(function(d){return d.type=="station"}), function(d){ return d.stats.occupancy});

	/***** Occupancies Standard Deviation *****/
	var occupStD = Math.sqrt(occupVar);


	/***** NEEDS CHECKING - SEE d3.variance() function *****/
	/***** Occupancies Variance *****/
	var occupVar = d3.variance(stocks.filter(function(d){return d.type=="station"}), function(d){ return d.stats.occupancy});
	var occupVar = d3.mean(stocks.filter(function(d){return d.type=="station"}), function(d){
		var meanStationsOccup = (stocks[0].stats.occupancy + stocks[1].stats.occupancy)/2;
		return Math.pow(d.stats.occupancy-meanStationsOccup,2)
	});



	var meanOccupDist = d3.mean(stocks.filter(function(d){return d.type=="station"}), function(d){
		return Math.abs(d.stats.occupancy_positive-d.stats.occupancy_negative)
	});

	var meanOccupDist2 = d3.mean(stocks.filter(function(d){return d.type=="station"}), function(d){
		return Math.abs(d.stats.occupancy_positive-d.stats.occupancy_negative + stocks[0].stats.occupancy_positive/stocks.filter(function(d){return d.type=="station"}).length)
	});

	var meanOccupPos = d3.mean(stocks.filter(function(d){return d.type=="station"}), function(d){
		return d.stats.occupancy_positive
	});

	var sumPosNegOccup = d3.mean(stocks, function(d){
		return Math.abs(d.stats.occupancy_positive-d.stats.occupancy_negative)
	});
	var sumPosNegOccupLoc = d3.mean(stocks.filter(function(d){return d.type=="station"}), function(d){
		return Math.abs(d.stats.occupancy_positive-d.stats.occupancy_negative)
	});

	var omega_P = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
		return d.stats.occupancy_positive
	});
	var omega_N = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
		return d.stats.occupancy_negative
	});
	var omega_M = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
		return d.stats.occupancy
	});

	return {
		'date': formatTime(date),
		'day': formatDay(date),
		'system': systemName,
		'nTrips': trips.length,
		'avgDepVar': +avgDepVar.toFixed(3),
		'avgDepStD': +avgDepStD.toFixed(3),
		'avgDepArrDist': +avgDepArrDist.toFixed(3),
		'systemTrend' : +(100*systemTrend).toFixed(3),
		'VHT': +VHT.toFixed(3),
		'VHD': +VHD.toFixed(3),
		'VHP': +VHP.toFixed(3),
		'VHPmin': +(VHPmin.toFixed(3)),
		'VHPmarginal': +(VHPmarginal.toFixed(3)),
		'VHPseasonal': +(VHPseasonal.toFixed(3)),
		'VHPtrend': +(VHPtrend.toFixed(3)),
		// 'deltaVHP': +(deltaVHP.toFixed(3)),
		// 'deltaVH': +(deltaVH.toFixed(3)),
		'VHP/VHT': +(VHP/VHT).toFixed(3),
		'VHPmin/VHT': +(VHPmin/VHT).toFixed(3),
		'VHPmarginal/VHT': +(VHPmarginal/VHT).toFixed(3),
		'deltaVHP(%)': +(100*(VHPmin-VHPmarginal)/VHPmarginal).toFixed(3),
		'VHPseasonal/VHT': +(VHPseasonal/VHT).toFixed(3),
		'VHPtrend/VHT': +(VHPtrend/VHT).toFixed(3),
		'VHD/VHT': +(VHD/VHT).toFixed(3),
		'deltaVHP/VHD': +((VHPmarginal-VHPmin)/VHD).toFixed(3),
		'deltaVH/VHT': +(deltaVH/VHT).toFixed(3),
		'VHT/VH': +(VHT/(VHT+VHP+VHD)).toFixed(3),
		'maxVHT/VH': +(VHT/(VHT+VHPmin+VHD)).toFixed(3),
		'meanAbsDevOccup': +(meanAbsDevOccup.toFixed(3)),	//mean absolute deviation of occupancies
		'occupVar': +(occupVar.toFixed(3)),
		'occupStD': +(occupStD.toFixed(3)),
		'meanOccupDist': +(meanOccupDist.toFixed(3)),
		'meanOccupDist2': +(meanOccupDist2.toFixed(3)),
		'meanOccupPos': +(meanOccupPos.toFixed(3)),
		'sumPosNegOccup': +(sumPosNegOccup.toFixed(3)),
		'sumPosNegOccupLoc': +(sumPosNegOccupLoc.toFixed(3)),
		'omega_P/VHT': +((omega_P/VHT).toFixed(3)),
		'omega_N/VHT': +((omega_N/VHT).toFixed(3)),
		'omega_M/VHT': +((omega_M/VHT).toFixed(3)),
	}
}
function exportCSV(records, fileName){
	console.log("exporting CSV....");
	var createCsvWriter = require('csv-writer').createObjectCsvWriter;
	var csvWriter = createCsvWriter({
		path: fileName + '.csv',
		header: [
		{id: 'date', title: 'Date'},
		{id: 'day', title: 'Day'},
		{id: 'system', title: 'BSS'},
		{id: 'nTrips', title: 'N Trips'},
		{id: 'systemTrend', title: 'Trend (%)'},
		{id: 'deltaVH/VHT', title: 'D VHP/VHT'},

		{id: 'VHT', title: 'VHT'},
		{id: 'VHP/VHT', title: 'VHP/VHT'},
		{id: 'VHPmarginal/VHT', title: 'VHPmarginal/VHT'},
		{id: 'VHPmin/VHT', title: 'VHPmin/VHT'},
		{id: 'VHD/VHT', title: 'VHD/VHT'},
		{id: 'deltaVHP(%)', title: 'D VHP (%)'},
		{id: 'deltaVHP/VHD', title: 'D VHP/VHD'},
		{id: 'meanAbsDevOccup', title: 'meanAbsDevOccup'},


		// {id: 'avgDepVar', title: 'avgDepVar'},
		// {id: 'avgDepStD', title: 'avgDepStD'},
		// {id: 'avgDepArrDist', title: 'avgDepArrDist'},
		// {id: 'VHD', title: 'VHD'},
		// {id: 'VHP', title: 'VHP'},
		// {id: 'VHPmin', title: 'VHPmin'},
		// {id: 'VHPmarginal', title: 'VHPmarginal'},
		// {id: 'VHPseasonal', title: 'VHPseasonal'},
		// {id: 'VHPtrend', title: 'VHPtrend'},
		// {id: 'deltaVHP', title: 'deltaVHP'},
		// {id: 'deltaVH', title: 'deltaVH'},
		// {id: 'VHPseasonal/VHT', title: 'VHPseasonal/VHT'},
		// {id: 'VHPtrend/VHT', title: 'VHPtrend/VHT'},

		// {id: 'VHT/VH', title: 'VHT/VH'},
		// {id: 'maxVHT/VH', title: 'maxVHT/VH'},
		// {id: 'occupVar', title: 'occupVar'},
		// {id: 'occupStD', title: 'occupStD'},
		// {id: 'meanOccupDist', title: 'meanOccupDist'},
		// {id: 'meanOccupDist2', title: 'meanOccupDist2'},
		// {id: 'meanOccupPos', title: 'meanOccupPos'},
		// {id: 'sumPosNegOccup', title: 'sumPosNegOccup'},
		// {id: 'sumPosNegOccupLoc', title: 'sumPosNegOccupLoc'},
		// {id: 'omega_P/VHT', title: 'omega_P/VHT'},
		// {id: 'omega_N/VHT', title: 'omega_N/VHT'},
		// {id: 'omega_M/VHT', title: 'omega_M/VHT'},
		]
	});
	csvWriter.writeRecords(records)       // returns a promise
	.then(() => {
		console.log('...Done');
	});
}





/********** NOT IN USE BUT GOOD TO HAVE **********/
/********** NOT IN USE BUT GOOD TO HAVE **********/

function getStocks(trips, timeRange){
	var stocks = [];
	var vehicleIDs = [];
  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
    stackOrder: 1,
    values : []
  });
	trips.forEach(function(trip) {
    if (stocks.find(function(d){return d.name==trip.start_station })==null) {
      stocks.push({
        type  : 'station',
        name  : trip.start_station_name,
        id    : trip.start_station,
        lat   : trip.start_station_lat,
        lng   : trip.start_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
			vehicleIDs.push(trip.bikeid);
    }
    if (stocks.find(function(d){return d.name==trip.end_station })==null){
      stocks.push({
        type  : 'station',
        name  : trip.end_station_name,
        id    : trip.end_station,
        lat   : trip.end_station_lat,
        lng   : trip.end_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
			vehicleIDs.push(trip.bikeid);
    }
		// INITIALIZE locational stocks
		if (!vehicleIDs.includes(trip.bikeid)) {
			stocks.find(function(d){return d.name==trip.start_station }).initial++;
		}
		// INITIALIZE inTransit & dispatched stocks
		if(trip.start_date<=timeRange[0]){
			if(trip.type=="full") stocks.find(function(d){return d.name=='inTransit'}).initial++;
			if(trip.type=="empty") stocks.find(function(d){return d.name=='dispatched'}).initial++;
		}
	});
	return stocks;
}
function getVehicleIDs(trips){
	var vehicles = [];
	trips.forEach(function(trip) {
		if (!vehicles.includes(trip.bikeid)) {
			vehicles.push(trip.bikeid);
		}
	});
	return vehicles;
}
function getVehicles(trips){
	var vehicles = [];
	var vehicleIDs = new Set();
	trips.forEach(function(trip) {
		if (!vehicleIDs.has(trip.bikeid)) {
			vehicles.push({
				id : trip.bikeid,
				type: 'vehicle'
			});
			vehicleIDs.add(trip.bikeid);
		}
	});
	return vehicles;
}
function getStocksFromTrips(trips){
	var stocks = [];
	var stationIDs = new Set();
  stocks.push({
    type  : 'inTransit',
    name  : 'inTransit',
    id    : 'inTransit',
    initial: 0,
    stackOrder: 0,
    values : []
  });
  stocks.push({
    type  : 'dispatched',
    name  : 'dispatched',
    id    : 'dispatched',
    initial: 0,
    stackOrder: 1,
    values : []
  });
	trips.forEach(function(trip) {
		if (!stationIDs.has(trip.start_station)) {
      stocks.push({
        type  : 'station',
        name  : trip.start_station_name,
        id    : trip.start_station,
        lat   : trip.start_station_lat,
        lng   : trip.start_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
      stationIDs.add(trip.start_station);
    }
    if (!stationIDs.has(trip.end_station)){
      stocks.push({
        type  : 'station',
        name  : trip.end_station_name,
        id    : trip.end_station,
        lat   : trip.end_station_lat,
        lng   : trip.end_station_lng,
        initial: 0,
        stackOrder: 10,
        values : []
      });
			stationIDs.add(trip.end_station);
    }
	});
	return stocks;
}
function setInitialLevels(trips, stocks, timeRange){
	var stockIDs = new Set();
	var vehicleIDs = new Set();
  stocks.forEach(function(stock){
    stockIDs.add(stock.name);
  });
	trips.forEach(function(trip) {
		if (!vehicleIDs.has(trip.bikeid)) {
			vehicleIDs.add(trip.bikeid);
			stocks.find(function(d){return d.name==trip.start_station }).initial++;
		}
		if(trip.start_date<=timeRange[0]){
			if(trip.type=="full") stocks.find(function(d){return d.name=='inTransit'}).initial++;
			if(trip.type=="empty") stocks.find(function(d){return d.name=='dispatched'}).initial++;
		}
	});
}


/********** IN PROGRESS **********/
/********** IN PROGRESS **********/
/********** IN PROGRESS **********/


// Use this to average an array of stocks, e.g. the outcome of getDataPerDay(trips, startDate, endDate);
function averageValuesStack(flowRates){
	var averageFlowRates = flowRates[0].map(function(d,k){
		var avgFlowRate = {};
		for (p in d) avgFlowRate[p]=d[p];
		avgFlowRate.values.forEach(function(entry,i){
			entry.inFlows_full = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].inFlows_full});
			entry.outFlows_full = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].outFlows_full});
			entry.inFlows_empty = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].inFlows_empty});
			entry.outFlows_empty = d3.mean(flowRates.filter(function(d){return d.id == avgFlowRate.id}), function(d){return d.values[i].outFlows_empty});
		})
	})
  return averageFlowRates;
}
function setCorrectionFlowRates(stocks){
	console.log("making correction flow rates...");
	stocks.filter(function(d){return d.type=="station"}).forEach(function(stock,k){
		stock.values.forEach(function(tStep,i){
			var allDispatchOutFlowRates = d3.sum(stocks, function(_stock){
				if (_stock.type=="station"){
					var diff = _stock.values[i].inFlows_full-_stock.values[i].outFlows_full;
					if (diff>=0){
						return diff;
					} else {
						return 0;
					}
				}
			});
			var allDispatchInFlowRatesDemand = d3.sum(stocks, function(_stock){
				if (_stock.type=="station"){
					var diff = _stock.values[i].inFlows_full-_stock.values[i].outFlows_full;
					if (diff>=0){
						return 0;
					} else {
						return -diff;
					}
				}
			});

			var diff = tStep.inFlows_full-tStep.outFlows_full;
			if (diff>=0){
				tStep.dispatchOutFlowRate = diff;
				tStep.dispatchInFlowRate = 0;
			} else {
				tStep.dispatchOutFlowRate = 0;
				tStep.dispatchInFlowRate =  -diff * (allDispatchOutFlowRates/allDispatchInFlowRatesDemand);
			}
		})
	});
	return stocks;
}
function correctDynamics(stocks, dispatchWeight, dispatchDelay){
	// this function can be addedd after setFlowRatesFromTrips(trips, stocks, timeStep) and integrateLevelsFromFlowRates(vehicles, trips, stocks): it adds correction flows and re-integrates dynamics
	console.log("correcting dynamics...");
	for (var i=0; i<stocks[0].values.length; i++){
		stocks.forEach(function(stock){
			if (i==0){
				stock.values[i].bikes = stock.initial;
				stock.values[i].bikesUncorrected = stock.initial;
			} else {
				stock.values[i].bikes = stock.values[i-1].bikes - stock.values[i-1].outFlows_full + stock.values[i-1].inFlows_full - stock.values[i-1].dispatchOutFlowRate + stock.values[i-1].dispatchInFlowRate;
				stock.values[i].bikesUncorrected = stock.values[i-1].bikesUncorrected - stock.values[i-1].outFlows_full + stock.values[i-1].inFlows_full;
			}
		});

		var allDiff =  d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){
			return -Math.min(0, d.values[i].inFlows_full-d.values[i].outFlows_full + d.values[i].dispatchInFlowRate-d.values[i].dispatchOutFlowRate);
		});
		var dispatchedBikesInTransit = stocks.filter(function(d){return d.type=="dispatched"})[0].values[i].bikes;

		stocks.forEach(function(stock){
			if(stock.type=="station"){
				var netInFlowRate = stock.values[i].inFlows_full-stock.values[i].outFlows_full + stock.values[i].dispatchInFlowRate-stock.values[i].dispatchOutFlowRate;
				// // works (?): corrects both trends and occupancies with delay
				// stock.values[i].dispatchOutFlowRate =+ netInFlowRate>=0 ? dispatchWeight * netInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ netInFlowRate>=0 ? 0 : -(netInFlowRate/allDiff) * dispatchedBikesInTransit / dispatchDelay;

				// // works (?): corrects only trends with delay
				// var allNegativeTrends =  d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){ return d.stats.trend>=0 ? 0 : d.stats.trend});
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? dispatchWeight * stock.stats.trend * stock.values[i].inFlows_full : 0;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? 0 :  (stock.stats.trend/allNegativeTrends) * dispatchedBikesInTransit / dispatchDelay;

				// works: corrects both trends and occupancies
				// stock.values[i].dispatchOutFlowRate =+ netInFlowRate>=0 ? dispatchWeight * netInFlowRate : 0;
				// stock.values[i].dispatchInFlowRate =+ netInFlowRate>=0 ? 0 : -dispatchWeight *netInFlowRate;

				// // works: corrects only trends
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? dispatchWeight * stock.stats.trend * stock.values[i].inFlows_full : 0;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? 0 : - dispatchWeight * stock.stats.trend * stock.values[i].outFlows_full;

				// works: corrects only occupancies
				// stock.values[i].dispatchOutFlowRate =+ stock.stats.trend>=0 ? (1-stock.stats.trend) * stock.values[i].inFlows_full : stock.values[i].inFlows_full;
				// stock.values[i].dispatchInFlowRate =+ stock.stats.trend>=0 ? stock.values[i].outFlows_full : (1+stock.stats.trend) * stock.values[i].outFlows_full;
			}
			if(stock.type=="dispatched"){
				stock.values[i].dispatchInFlowRate = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d.values[i].dispatchOutFlowRate});
				stock.values[i].dispatchOutFlowRate = d3.sum(stocks.filter(function(d){return d.type=="station"}), function(d){return d.values[i].dispatchInFlowRate});
			}
			if(stock.type=="inTransit"){
				stock.values[i].dispatchInFlowRate = 0;
				stock.values[i].dispatchOutFlowRate = 0;
			}
		});
	}
	return stocks;
}



// GET LEVELS WORKS THE SAME AS SETLEVELS - PROBLEM!!!!!!!
function getLevels_OLD(flowRates, initials){
	return flowRates.map(function(d,k){
		var result = {};
		Object.keys(d).forEach(key =>	result[key] = d[key]);
		// for (pname in d) result[pname]=d[pname]; // copy properties
		result.values.forEach(function(entry,i){
			var initial = initials? initials[k] : d.initial;
			entry.level = initial + d3.sum(d.values.slice(0,i+1), function(tStep){
				return tStep.inFlows_full + tStep.inFlows_empty - tStep.outFlows_full - tStep.outFlows_empty;
			});
		})
		return result;
	});
}
