angular.module('myApp', ['ngSanitize'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.orders = [];
      var args = window.location.search.split('&');
      var order_id = 'www-arbit';
      var uid = '124';

      for (var i=0;i<args.length;i++) {
        var name_value = args[i].split('=');
        if (name_value[0].match(/uid/)) {
         uid = name_value[1];
        } else if (name_value[0].match(/order_id/)) {
         order_id = name_value[1];
        }
      }

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
