angular.module('myApp', ['smart-table'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.nav = 'order-page';
      $scope.loaded = 0;
      $scope.new_user = true;
      $scope.app_loaded = true;

      /* On login, the following sequence is executed
       *   1. get profile of the user
       *   2. get community information
       *   3. get inventory list
       *   4. If profile exist
       *      1. set the current_community
       *      2. get orders for this user
       *   5. If profile does not exist
       *      1. set new_user = true
       *
       */

      $scope.onGoogleLogin = function(response) {
        console.log('onGoogleLogin');
        var profile = response.getBasicProfile();
        $scope.current_user = {id: profile.getId(), name: profile.getName(), profile_url: profile.getImageUrl(), email: profile.getEmail()};
        $http.get('/data/users/' + profile.getId() + '.json').success($scope.onProfle);
        $scope.app_loaded = false;
      }

      $scope.onProfle = function(data) {
        console.log('onProfle');
        if (data.status == 'success') {
          $scope.current_user = data.profile;
          $scope.new_user = false;
          console.log('user is registered');
        }
        $http.get('/data/communities.json').success($scope.onCommunityInformation);
      }

      $scope.onCommunityInformation = function (data) {
        console.log('onCommunityInformation');
        $scope.communities = data;

        if (!$scope.new_user) {
          for (var i=0;i<$scope.communities.length;i++) {
            var c = $scope.communities[i];
            if (c.name == $scope.current_user.community) {
              $scope.current_community = c;
              $scope.set_order_id();
              break;
            }
          }

          if ($scope.current_community == null) {
            console.log('could not fetch the community');
            $scope.new_user = true;
          }
        }

        if (!$scope.new_user) {
          $http.get('/data/data.json').success($scope.onInventory);
        } else {
          $scope.app_loaded = true;
          $scope.navigateTo('preferences');
        }
      }

      $scope.onInventory = function (data) {
        console.log('onInventory');
        $scope.loaded = 1;
        $scope.skus = [];

        for (var i=0;i<data.length;i++) {
          var d = data[i];
          if ((d.description.length > 0) && (d.available.toLowerCase() == 'yes')) {
            d.quantity = 0;
            d.price = 0;
            $scope.skus.push(d);
          }
        }

        // Get user order
        $http.get('/data/orders/' + $scope.order_id + '/user.json?uid=' + $scope.current_user.id).success($scope.onUserOrders);

      }

      $scope.onUserOrders = function (data) {
        console.log('onUserOrders');
        for (var i = 0;i<data.length;i++) {
          for (var j = 0;i<$scope.skus.length;j++) {
            if ($scope.skus[j].description == data[i].description) {
              $scope.skus[j].quantity = data[i].quantity;
              $scope.skus[j].price = data[i].price;
              break;
            }
          }
        }
        $scope.navigateTo('order-page');
        $scope.app_loaded = true;
      }

      $scope.options = {
        'onsuccess': $scope.onGoogleLogin,
        'onfailure': function(response) {
          console.log('failed to login');
        }
      }

      $scope.$on('event:google-plus-signin-success', function (event, authResult) {
        // User successfully authorized the G+ App!
        console.log('Signed in!');
      });
      $scope.$on('event:google-plus-signin-failure', function (event, authResult) {
        // User has not authorized the G+ App!
        console.log('Not signed into Google Plus.');
      });

      $scope.registerUser = function() {
        console.log('registerUser');
        $http.post('/data/users/' + $scope.current_user.id + '.json', $scope.current_user).success($scope.onProfle);
      }

      $scope.navigateTo = function(dest) {
        if (!$scope.new_user) {
          $scope.nav = dest;
        } else {
          $scope.nav = 'preferences';
        }
      }

      $scope.current_order = function () {
        var items = [];
        for (var i=0;i<$scope.skus.length;i++) {
          if ($scope.skus[i].quantity > 0) {
            items = items.concat($scope.skus[i]);
          }
        }
        return items;
      }

      $scope.submitOrder = function() {
        $('#loadingModel').modal('show');
        $http.post('/data/orders/' + $scope.order_id + '.json?uid=' + $scope.current_user.id, $scope.current_order()).success(function () {
          $('#loadingModel').modal('hide');
          $scope.warning_message = $scope.error_message = null;
          $scope.success_message = "Congratulations !! Your order has been placed";
        });
      }

      $scope.signOut = function() {
        var auth2 = gapi.auth2.getAuthInstance();
        auth2.signOut().then(function () {
          console.log('User signed out.');
          $scope.$apply(function () {
            $scope.current_user = null;
            $scope.current_community = null;
            $scope.skus = [];
          });
        });
      }

      $scope.totalPrice = function () {
        var skus = $scope.skus;
        var ret = 0;
        for (var i=0;i<skus.length;i++) {
          ret += skus[i].quantity * skus[i].rate ;
        }
        return ret;
      }

      $scope.set_order_id = function () {
        var weekday = ['sunday', 'monday','tuesday','wednesday','thursday','friday','saturday'];

        var d = new Date(); // today's date
        var w = $scope.current_community.order_window.end.day_of_week;
        var weekday_index = weekday.indexOf(w);
        var diff = weekday_index - d.getDay();
        if (diff < 0) {
          diff += 7;
        }
        d.setDate(d.getDate()+diff);
        $scope.order_id = [d.getFullYear(), d.getMonth()+1, d.getDate()].join('-');
        $scope.check_if_shop_is_open();
      }

      $scope.check_if_shop_is_open = function () {
        var weekday = ['sunday', 'monday','tuesday','wednesday','thursday','friday','saturday'];
        var d = new Date(); // today's date
        var open_day = $scope.current_community.order_window.start.day_of_week;
        var close_day = $scope.current_community.order_window.end.day_of_week;
        var open_day_index = weekday.indexOf(open_day);
        var close_day_index = weekday.indexOf(close_day);
        var current_day_index = d.getDay();

        if (open_day_index == current_day_index) {
          // The shop is open today. But are you early?
          $scope.warning_message = "The shopping window has opened today. Place order before end of window";
          console.log("same day as opening day");
          return;
        }

        if (close_day_index == current_day_index) {
          // The shop will close today. Are you late?
          $scope.warning_message = "The shopping window is closing today. Place order before " + $scope.current_community.order_window.end.time ;
          console.log("same day as closing day");
          return;
        }

        // set open_day as zero
        close_day_index = (close_day_index - open_day_index + 7) % 7;
        current_day_index = (current_day_index - open_day_index + 7) % 7;
        if (current_day_index < close_day_index) {
          // Phew.. we have time to order
          console.log('can place order');
        } else {
          $scope.error_message = "The shopping window is not open. You cannot place an order.";
          console.log('cannot place order');
          // Sorry. You need to wait for couple of days
        }
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

