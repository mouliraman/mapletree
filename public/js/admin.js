angular.module('myApp', ['ngSanitize', 'smart-table'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.nav = 'order-page';
      $scope.new_user = true;
      $scope.app_loaded = true;
      $scope.orders = [];
      $scope.order_select = {};

      $scope.today_date = new Date();

      $scope.format_date = function (d) {
        return [d.getFullYear(), d.getMonth()+1, d.getDate()].join('-');
      }

      $scope.getUsersPerCommunity = function () {
        if (($scope.users) && ($scope.communities)) {
          for(var i=0;i<$scope.communities.length;i++) {
            $scope.communities[i].users =
              $scope.users.filter(function(x) { return (x.community == $scope.communities[i].name)});
          }
        }
      }

      $scope.onGetAllUsers = function(response) {
        $scope.users = response.users;
        $scope.user_id_mapping = {};
        for(var i = 0;i<$scope.users.length;i++) {
          $scope.user_id_mapping[$scope.users[i].id] = $scope.users[i];
        }
        $scope.getUsersPerCommunity();
      }

      $scope.onCommunityInformation = function(response) {
        $scope.communities = response;
        jQuery('.input-group.date').datepicker({
          format: "yyyy-m-d",
          autoclose: true,
          todayHighlight: true
        });
        $scope.getUsersPerCommunity();
      }

      $scope.fetchOrder = function () {
        // check if the uid belongs to the community
        if ($scope.order_select.uid) {
          var user = $scope.user_id_mapping[$scope.order_select.uid];
          if (user.community != $scope.order_select.community) {
            $scope.order_select.uid = null;
          }
        }
        if ($scope.order_select.order_id) {
          $http({url: '/data/orders/' + $scope.order_select.order_id + '.json', method: 'GET', params: $scope.order_select}).success($scope.onGetOrders);
        }
      }
      $scope.usersPerCommunity = function(c) {
        if (c) {
          return $scope.users.filter(function(x) { return (x.community == c)});
        } else {
          return [];
        }
      }

      $scope.totalPrice = function (packed) {
        var skus = $scope.orders[$scope.order_select.order_id];
        var ret = 0;
        for (var i=0;i<skus.length;i++) {
          if (packed) {
            ret += skus[i].packed_quantity * skus[i].rate ;
          } else {
            ret += skus[i].quantity * skus[i].rate ;
          }
        }
        ret = Math.round(ret * 100)/100;
        return ret;
      }

      $scope.price = function(a,b) {
        return(Math.round(a * b * 100)/100);
      }

      $scope.onGetOrders = function(response) {
        $scope.orders[response.order_id] = response.orders;
        if ($scope.order_select.uid) {
          $scope.order_select.editable = true;
          $scope.order_select.state = response.state;
          for (var i=0;i<$scope.orders[response.order_id].length;i++) {
            var order = $scope.orders[response.order_id][i];
            if (!order.packed_quantity) {
              order.packed_quantity = 0;
            }
            order.price = $scope.price(order.rate, order.quantity);
          }
        } else {
          $scope.order_select.editable = false;
        }
      }

      $scope.submitOrder = function() {
        console.log('calling submitOrder');
        $scope.ajax_waiting = true;
        if ($scope.order_select.order_id && $scope.order_select.uid) {
          $http.post('/data/orders/' + $scope.order_select.order_id + '.json?uid=' + $scope.order_select.uid, 
              $scope.orders[$scope.order_select.order_id]).success(function () {
            $scope.warning_message = $scope.error_message = null;
            $scope.ajax_waiting = false;
          }).error(function (err) {
            $scope.error_message = "Something went wrong !! Please try again.";
            $scope.ajax_waiting = false;
          });
        }
      }

      $scope.onProfle = function(response) {
        $scope.error_message = null;
        if ((response.status == 'success') && (response.profile.admin)) {
          $scope.current_user = response.profile;
          $http.get('/users/all.json').success($scope.onGetAllUsers);
          $http.get('/data/communities.json').success($scope.onCommunityInformation);
        } else {
          $scope.error_message = "Only admin users have access to this page";
          $scope.signOut();
        }

      }

      $scope.onGoogleLogin = function(response) {
        var profile = response.getBasicProfile();
        $http.get('/users/' + profile.getId() + '.json').success($scope.onProfle);
      }

      $scope.options = {
        'onsuccess': $scope.onGoogleLogin,
        'onfailure': function(response) {
          console.log('failed to login');
        }
      }

      $scope.signOut = function() {
        var auth2 = gapi.auth2.getAuthInstance();
        auth2.signOut().then(function () {
          $scope.$apply(function () {
            $scope.current_user = null;
          });
        });
      }

      $scope.download_csv = function(d) {
        var data = $scope.orders[$scope.order_select.order_id];
        var CSV = "S.No,Description,Rate,Unit,Quantity,Price\r\n";
        
        for (var i=0; i<data.length; i++) {
          CSV += i+1;
          CSV += ',' + data[i].description;
          CSV += ',' + data[i].rate;
          CSV += ',' + data[i].unit;
          CSV += ',' + data[i].quantity;
          CSV += ',' + (data[i].rate * data[i].quantity);
          CSV += "\r\n";
        }
        var uri = 'data:application/csv;charset=utf-8,' + escape(CSV);
        var link = document.createElement("a");
        link.href = uri;
        link.style = "visibility:hidden";
        link.download = $scope.order_select.order_id + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

    }
])
.filter('unique', function() {
  return function (arr, field) {
    var o = {}, i, l = arr.length, r = [];
    for(i=0; i<l;i+=1) {
      o[arr[i][field]] = arr[i];
    }
    for(i in o) {
      r.push(o[i]);
    }
    return r;
  };
}
)
.directive('googleSignInButton', function() {
  return {
    scope: {
             buttonId: '@',
             options: '&'
           },
    template: '<div></div>',
    link: function(scope, element, attrs) {
      var div = element.find('div')[0];
      div.id = attrs.buttonId;
      gapi.signin2.render(div.id, scope.options()); //render a google button, first argument is an id, second options
    }
  };
});

$( document ).ready(function() {
  console.log('dcoument loaoded');
});
