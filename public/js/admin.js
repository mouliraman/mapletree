angular.module('mapletreeAdmin', ['ngSanitize'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.app_loaded = true;
      $scope.order = {items: []};
      $scope.order_select = {};
      $scope.last_sync_time = "fetching....";
      $scope.spin = {};
      $scope.selected_community_index = -1;
      $scope.inventory_usage = {
        start_date: '2016-10-01',
        end_date: '2016-10-31',
        items: []
      }

      $scope.format_date = function (d) {
        return [d.getFullYear(), d.getMonth()+1, d.getDate()].join('-');
      }
      $scope.order_select.order_id = $scope.format_date(new Date());

      $scope.select_community = function (c) {
        $scope.selected_community_index = c;
      }
      $scope.fetch_sync_date = function () {
        $http.get('/export.date').success(function (res) {
          $scope.last_sync_time = res;
        });
      }

      $scope.sync_db = function () {
        $scope.ajax_waiting = true;
        $http.post('/data/sync').success(function (res) {
          $scope.ajax_waiting = false;
          $scope.fetch_sync_date();
        }).error(function (err) {
          $scope.ajax_waiting = false;
        });
      }

      $scope.getUsersPerCommunity = function () {
        if (($scope.users) && ($scope.communities)) {
          for(var i=0;i<$scope.communities.length;i++) {
            $scope.communities[i].users =
              $scope.users.filter(function(x) { return (x.community == $scope.communities[i].name)});
          }
        }
      }

      $scope.get_weekday = function(w) {
        var weekday = ['sunday', 'monday','tuesday','wednesday','thursday','friday','saturday'];
        return weekday[w];
      }
      $scope.communitiesForDay = function (d) {
        var dd = new Date(d);
        var end_day = $scope.get_weekday(dd.getDay());
        var c = [];
        for (var i = 0 ; i< $scope.communities.length;i++) {
          if (($scope.communities[i].end_day == end_day) && ($scope.communities.state = 'active')) {
            c.push($scope.communities[i]);
          }
        }
        return(c);
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

      $scope.fetchInventory = function () {
        $http({
          url: '/data/orders/used_inventory/' + $scope.inventory_usage.start_date + '/' + $scope.inventory_usage.end_date + '.json',
          method: 'GET'
        }).success(function (res) {
          $scope.inventory_usage = res;
        });
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
        var skus = $scope.order.items;
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
        $scope.order = response;

        for (var i=0;i<$scope.order.items.length;i++) {
          var item = $scope.order.items[i];
          if (!item.packed_quantity) {
            item.packed_quantity = 0;
          }
          item.quantity = Math.round(item.quantity * 1000)/1000;
          item.price = $scope.price(item.rate, item.quantity);
        }
 
        if ($scope.order_select.uid) {
          $scope.order_select.editable = true;
       } else {
          $scope.order_select.editable = false;
        }
      }

      $scope.saveUserInfo = function(user) {
        $scope.spin[user.id] = true;
        $http.post('/users/' + user.id + '.json', user).success(function (c){
          $scope.spin[user.id] = false;
        }).error(function(err) {
          $scope.spin[user.id] = false;
        });
        console.log('saving user ' + user.email + ' door number ' + user.door_number);
      }
      $scope.submitOrder = function(state) {
        $scope.ajax_waiting = true;
        $scope.order.state = state;
        $scope.order.total_price = $scope.totalPrice(true);

        if ($scope.order_select.order_id && $scope.order_select.uid) {
          $http.post('/data/orders/' + $scope.order_select.order_id + '.json?admin=1&uid=' + $scope.order_select.uid, 
              $scope.order).success(function (response) {
            if (response.error) {
              $scope.error_message = response.message;
            } else {
              $scope.warning_message = $scope.error_message = null;
            }
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
          $scope.fetch_sync_date();
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
        var data = $scope.order.items;
        var CSV = "";
        var user;

        CSV += ",Mapletree Farms,,,,INVOICE\r\n";
        CSV += "\r\n";
        CSV += "To\r\n";
        if ($scope.order_select.uid) {
          user = $scope.user_id_mapping[$scope.order_select.uid];
          CSV += "," + user.name + "\r\n";
        } else if ($scope.order_select.community) {
          CSV += ", Order for " + $scope.order_select.community + "\r\n";
        } else {
          CSV += ", Order for All\r\n";
        }
        CSV += "\r\n";
        CSV += "S.No,Description,Rate,Unit,Quantity,Price\r\n";
        
        for (var i=0; i<data.length; i++) {
          CSV += i+1;
          CSV += ',' + data[i].description;
          CSV += ',' + data[i].rate;
          CSV += ',' + data[i].unit;
          CSV += ',' + data[i].quantity;
          CSV += ',' + (data[i].rate * data[i].quantity);
          CSV += "\r\n";
        }
        CSV += "\r\n";
        CSV += ",Total Amount,,,," + $scope.totalPrice() + "\r\n";
        CSV += "\r\n";
        CSV += "Customer Instructions :,\r\n";
        if ($scope.order.customer_instructions) {
          CSV += $scope.order.customer_instructions + ",\r\n";
        }
        CSV += "\r\n";
        CSV += "Account Details :\r\n";
        CSV += "Mapletree Farms Pvt. Ltd.\r\n";
        CSV += "A/C No: 914020043283947\r\n";
        CSV += "Axis Bank, Jayanagar Branch, Bangalore\r\n";
        CSV += "IFSC Code: UTIB0000052\r\n";

        var uri = 'data:application/csv;charset=utf-8,' + escape(CSV);
        var link = document.createElement("a");
        link.href = uri;
        link.style = "visibility:hidden";
        if ($scope.order_select.uid) {
          link.download = $scope.order_select.order_id + "-" + $scope.order_select.community + "-" + user.name + ".csv";
        } else if ($scope.order_select.community) {
          link.download = $scope.order_select.order_id + "-" + $scope.order_select.community + ".csv";
        } else {
          link.download = $scope.order_select.order_id + ".csv";
        }
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

