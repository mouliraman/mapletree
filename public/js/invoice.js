angular.module('myApp', ['ngSanitize'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.orders = [];

      var order_id = '2016-9-2';
      var uid = '2857242207974196';
      $http.get('/data/orders/' + order_id + '/user.json?uid=' + uid).success(function (data) {
        $scope.orders = data;
      });

      $scope.totalPrice = function () {
        var skus = $scope.orders;
        var ret = 0;
        for (var i=0;i<skus.length;i++) {
          ret += skus[i].quantity * skus[i].rate ;
        }
        return Math.round(ret * 100)/100;
      }

      $scope.price = function(a,b) {
        return(Math.round(a * b * 100)/100);
      }

    }
]);
