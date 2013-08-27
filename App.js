var peRecords=[],acceptedData=[];

                Ext.define("MyBurnCalculator",{
                    extend:"Rally.data.lookback.calculator.TimeSeriesCalculator",
                    getMetrics:function(){
                        var metrics=[{
                            field:"PlanEstimate",
                            as:"Planned Points",
                            display:"line",
                            f:"sum"
                        },{
                        //    field:"CalcPreliminaryEstimate",
                        //    as:"PreliminaryEstimate",
                        //    display:"line",
                        //    f:"sum"
                        //},{
                            field:"PlanEstimate",
                            as:"Accepted Points",
                            display:"line",
                            f:"filteredSum",
                            filterField: 'ScheduleState',
                            filterValues: ["Accepted"]
                        },{
                            field:"ObjectID",
                            as:"Count",
                            display:"column",
                            f:"count"
                        //},{
                        //    field:"Completed",
                        //    as:"Completed",
                        //    display:"column",
                        //    f:"sum"
                        }];
                        return metrics
                    },

                    getDerivedFieldsOnInput:function(){
                        //return[{
                        //    as:"CalcPreliminaryEstimate",
                        //    f:function(row){
                        //        var r=_.find(peRecords,function(rec){
                        //            return rec.get("ObjectID")==row.PreliminaryEstimate});
                        //        return void 0!=r?r.get("Value"):0}
                        //    },{
                        //        as:"Completed",
                        //        f:function(row){return 1==row.PercentDoneByStoryCount?1:0}
                        //}]
                    },
                    
                    getDerivedFieldsAfterSummary:function(){
                        return[{
                          as:"Projection",
                          f:function(row,index,summaryMetrics,seriesData){
                            if(0==index){
                                datesData=_.pluck(seriesData,"label"),
                                acceptedData=_.pluck(seriesData,"Accepted Points"),
                                console.log("accepted date len",acceptedData.length);
                                var today=new Date;
                                acceptedData=_.filter(acceptedData,function(d,i){
                                    return today>new Date(Date.parse(datesData[i]))
                                }),
                                console.log("accepted date len",acceptedData.length)
                            }
                            var y=linearProject(acceptedData,index);
                            return y
                          }
                        }]
                    },

                    defined:function(v){
                        return!_.isUndefined(v)&&!_.isNull(v)
                    }

                }),

                Ext.define("CustomApp",{
                    scopeType:"release",
                    extend:"Rally.app.App",
                    componentCls:"app",
                    launch:function(){
                        console.log("launch");
                        var timeboxScope=this.getContext().getTimeboxScope(),
                        tbName=null;
                        if(timeboxScope){
                            var record=timeboxScope.getRecord();
                            tbName=record.get("Name")
                        } else 
                            tbName="";
                         //   var peStore=Ext.create("Rally.data.WsapiDataStore",{
                         //       autoLoad:!0,
                         //       model:"PreliminaryEstimate",
                         //       fetch:["Name","ObjectID","Value"],
                         //       filters:[],
                         //       listeners:{
                         //           scope:this,
                         //           load:function(store,data){
                         //               peRecords=data,
                                        this.queryReleases(tbName)
                         //           }
                         //       }
                         //   })
                        },

                        queryReleases:function(name){
                            var releaseStore;
                            return releaseStore=Ext.create("Rally.data.WsapiDataStore",{
                                autoLoad:!0,
                                model:"Release",
                                fetch:["Name","ObjectID","Project","ReleaseStartDate","ReleaseDate"],
                                filters:[],
                                listeners:{
                                    load:function(store,releaseRecords){
                                        var releases=_.map(releaseRecords,
                                            function(rec){
                                                return{
                                                    name:rec.get("Name"),
                                                    objectid:rec.get("ObjectID")
                                                }
                                            }
                                        );
                                        releases=_.uniq(releases,function(r){
                                            return r.name
                                        });
                                        var releasesStore=Ext.create("Ext.data.Store",{
                                            fields:["name","objectid"],
                                            data:releases
                                        }),
                                        cb=Ext.create("Ext.ux.CheckCombo",{
                                            fieldLabel:"Release",
                                            store:releasesStore,
                                            queryMode:"local",
                                            displayField:"name",
                                            valueField:"name",
                                            noData:!0,
                                            width:300,
                                            listeners:{
                                                scope:this,
                                                collapse:function(field,eOpts){
                                                    var releases=[];
                                                    _.each(field.getValue().split(","),
                                                    function(rn){
                                                        _.each(_.filter(releaseRecords,function(r){
                                                            return rn==r.get("Name")
                                                        }),
                                                        function(rel){
                                                            releases.push(rel)
                                                        })
                                                    }),
                                                    this.querySnapshots(releases)
                                                }
                                            }
                                        });
                                        this.add(cb)
                                    },
                                    scope:this
                                }
                            })
                    },

                    querySnapshots:function(releases){
                        var ids=_.pluck(releases,function(release){
                            return release.get("ObjectID")
                        });
                        this.chartConfig.storeConfig.find.Release={$in:ids};
                        var start=_.min(_.pluck(releases,function(r){
                            return r.get("ReleaseStartDate")
                        })),
                        end=_.max(_.pluck(releases,function(r){
                            return r.get("ReleaseDate")
                        }));
                        console.log("start",start),
                        console.log("end",end),
                        this.chartConfig.calculatorConfig.startDate=start,
                        this.chartConfig.calculatorConfig.endDate=end;
                        var chart=this.down("#myChart");
                        null!=chart&&this.remove(chart),
                        console.log(this.chartConfig),
                        this.add(this.chartConfig)
                    },

                    chartConfig:{
                        xtype:"rallychart",
                        itemId:"myChart",
                        chartColors:["Gray","Orange","Green","Blue","Green","LightGray"],
                        storeConfig:{
                            find:{_TypeHierarchy:{$in:["HierarchicalRequirement"]}},
                            autoLoad:!0,
                            limit:1/0,
                            fetch:["ObjectID","Name","_TypeHierarchy","PlanEstimate","ScheduleState"],
                            hydrate:["_TypeHierarchy","PlanEstimate"]
                        },
                        calculatorType:"MyBurnCalculator",
                        calculatorConfig:{},
                        chartConfig:{
                            plotOptions:{
                                series:{marker:{radius:2}}
                            },
                            chart:{
                                colors:[],
                                zoomType:"xy"
                            },
                            title:{
                                text:"Cross-Release Burnup"
                            },
                            xAxis:{
                                tickInterval:7,
                                labels:{
                                    formatter:function(){
                                        var d=new Date(this.value);
                                        return""+(d.getMonth()+1)+"/"+d.getDate()
                                    }
                                },
                                title:{text:"Days"}
                            },
                            yAxis:[{
                                title:{text:"Points"}
                            }]
                        }
                    }
                });
