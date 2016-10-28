angular.module('mapletreeUser', ['ngSanitize'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.nav = 'order-page';
      $scope.loaded = 0;
      $scope.new_user = true;
      $scope.app_loaded = true;
      $scope.user = {};
      $scope.ajax_waiting = false;

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

      $scope.onLogin = function(profile) {
        localStorage.setItem('uid',profile.id);
        console.log('setting uid ' + profile.id);
        $scope.current_user = profile;
        $http.get('/users/' + profile.id + '.json').success($scope.onProfle);
        $scope.app_loaded = false;
        $scope.shop_open = false;
        //$scope.$apply(function () {
          $('#signupModel').modal('hide');
        //});
      }

     $scope.onProfle = function(data) {
        $scope.ajax_waiting = false;
        if (data.status == 'success') {
          $scope.current_user = data.profile;
          $scope.new_user = false;
        }
        $http.get('/data/communities.json').success($scope.onCommunityInformation);
      }

      $scope.slug = function(a) {
        if (a) {
          return a.toLowerCase().replace((/\W+/g,'-'));
        }
        return 'NaaN';
      }

      $scope.onCommunityInformation = function (data) {
        $scope.communities = [];
        var user_com_slug = $scope.slug($scope.current_user.community);
        
        for (var i=0;i<data.length;i++) {
          if (data[i].state == 'active') {
            $scope.communities.push(data[i]);
            var c_slug = $scope.slug(data[i].name);

            if ((!$scope.new_user) && (c_slug == user_com_slug)) {
              $scope.current_community = data[i];
              $scope.set_order_id();
            }
          }
        }

        if ($scope.current_community == null) {
          console.log('could not fetch the community');
          $scope.new_user = true;
        }

        if (!$scope.new_user) {
          $http.get('/data/data.json').success($scope.onInventory);
        } else {
          $scope.app_loaded = true;
          $scope.navigateTo('preferences');
        }
      }

      $scope.onInventory = function (data) {
        $scope.loaded = 1;
        $scope.skus = [];
        $scope.category_skus = {};
        $scope.categories = [];

        for (var i=0;i<data.length;i++) {
          var d = data[i];
          if ((d.description.length > 0) && (d.available.toLowerCase() == 'yes')) {
            d.quantity = 0;
            d.price = 0;
            $scope.skus.push(d);
            if ($scope.category_skus[d.category]) {
              $scope.category_skus[d.category].push(d);
            } else {
              $scope.category_skus[d.category] = [d];
              $scope.categories.push(d.category);
            }
          }
        }

        // Get user order
        $http.get('/data/orders/' + $scope.order_id + '.json?uid=' + $scope.current_user.id).success($scope.onUserOrders);

      }

      $scope.onUserOrders = function (data) {
        $scope.order = data;
        for (var i = 0;i<data.items.length;i++) {
          for (var j = 0;i<$scope.skus.length;j++) {
            if ($scope.skus[j].description == data.items[i].description) {
              $scope.skus[j].quantity = data.items[i].quantity;
              $scope.skus[j].price = data.items[i].price;
              break;
            }
          }
        }
        $scope.navigateTo('order-page');
        $scope.app_loaded = true;
      }

      $scope.options = {
        'onsuccess': function(response) {
          console.log('google logged in');
          var profile = response.getBasicProfile();
          if (!$scope.current_user) {
            $scope.onLogin({id: profile.getId(), name: profile.getName(), profile_url: profile.getImageUrl(), email: profile.getEmail()});
          }
        },
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

      $scope.signInUser = function() {
        $scope.ajax_waiting = true;
        $scope.error_message = null;
        $http.post('/' + $scope.user.action + '.json', $scope.user).success(function(response) {
          if (response.status == 'success') {
            if ($scope.user.action == 'forgot') {
              $scope.error_message = null;
              $scope.warning_message = response.message;
            } else {
              $scope.onLogin(response.profile);
            }
          } else {
            $scope.error_message = response.reason;
            //TODO : Print an error
          }
          $scope.ajax_waiting = false;
        }).error(function (err) {
          if (err.message) {
            $scope.error_message = err.message;
          } else {
            $scope.error_message = "Something went wrong !! Please try again.";
          }
          $scope.ajax_waiting = false;
        });
      }

      $scope.registerUser = function() {
        $scope.ajax_waiting = true;
        $scope.error_message = null;
        $http.post('/users/' + $scope.current_user.id + '.json', $scope.current_user).success($scope.onProfle).error(function (err) {
          console.log(err);
          $scope.error_message = err.message;
          $scope.ajax_waiting = false;
        });
      }

      $scope.navigateTo = function(dest) {
        if (!$scope.new_user) {
          $scope.nav = dest;
        } else {
          $scope.nav = 'preferences';
        }

        if ($scope.nav == 'orders') {
          $http.get('/data/orders/'+$scope.current_user.id+'/index.json').success( function (res) {
            $scope.order_history = res.order_history;
            $scope.outstanding_balance = 0;
            for(var i=0;i<res.order_history.length;i++) {
              if (res.order_history[i].state == 'delivered') {
                $scope.outstanding_balance += res.order_history[i].discount_price;
              }
            }
          });
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
        if ($scope.check_if_shop_is_open()) {
          $scope.ajax_waiting = true;
          var order = {
            state: 'ordered',
            customer_instructions : $scope.order.customer_instructions,
            items: $scope.current_order(),
            total_price: $scope.totalPrice(),
            discount: 0
          };

          $http.post('/data/orders/' + $scope.order_id + '.json?uid=' + $scope.current_user.id, order).success(function () {
            $scope.warning_message = $scope.error_message = null;
            $scope.success_message = "Congratulations !! Your order has been placed";
            $scope.ajax_waiting = false;
          }).error(function (err) {
            $scope.error_message = err.message;
            $scope.ajax_waiting = false;
          });
        } else {
          $scope.error_message = "Sorry. Your order window is closed. You cannot place order.";
        }
      }

      $scope.signOut = function() {
        localStorage.setItem('uid','undefined');
        console.log('setting uid undefined');
        if (gapi.auth2) {
          var auth2 = gapi.auth2.getAuthInstance();
          auth2.signOut().then(function () {
            console.log('signed out of google');
            window.location = "/";
          });
        } else {
          console.log('signed out of password based authentication');
          window.location = "/";
        }
        return false;
      }

      $scope.price = function(a,b) {
        return(Math.round(a * b * 100)/100);
      }

      $scope.totalPrice = function () {
        var skus = $scope.skus;
        var ret = 0;
        for (var i=0;i<skus.length;i++) {
          ret += skus[i].quantity * skus[i].rate ;
        }
        return Math.round(ret * 100)/100;
      }

      $scope.get_time = function(t) {
        var d = new Date();
        var t_split = t.split(':');
        d.setHours(parseInt(t_split[0]));
        d.setMinutes(parseInt(t_split[1]));
        d.setSeconds(parseInt(t_split[1]));
        return d;
      }

      $scope.get_weekday = function(w) {
        var weekday = ['sunday', 'monday','tuesday','wednesday','thursday','friday','saturday'];
        return weekday.indexOf(w);
      }

      $scope.set_order_id = function () {

        var d = new Date(); // today's date
        var w = $scope.current_community.end_day;
        var weekday_index = $scope.get_weekday(w);
        var diff = weekday_index - d.getDay();
        if (diff < 0) {
          diff += 7;
        }
        d.setDate(d.getDate()+diff);
        $scope.order_id = [d.getFullYear(), d.getMonth()+1, d.getDate()].join('-');
        $scope.check_if_shop_is_open();
      }

      $scope.check_if_shop_is_open = function () {
        var d = new Date(); // today's date
        var open_day_index = $scope.get_weekday($scope.current_community.start_day);
        var close_day_index = $scope.get_weekday($scope.current_community.end_day);
        var current_day_index = d.getDay();

        if (open_day_index == current_day_index) {
          // The shop is open today. But are you early?
          var start_time = $scope.get_time($scope.current_community.start_time);
          if (start_time > new Date()) {
            $scope.warning_message = "The shopping window will open today at <b>" + $scope.current_community.start_time + "</b>. Please come back to place the order.";
          } else {
            $scope.success_message = "Shopping window has opened. Please place your order";
            $scope.shop_open = true;
          }
        }

        else if (close_day_index == current_day_index) {
          // The shop will close today. Are you late?
          var end_time = $scope.get_time($scope.current_community.end_time);
          if (end_time < new Date()) {
            $scope.error_message = "The shopping window has closed for today.";
          } else {
            $scope.warning_message = "The shopping window is closing today. Place order before " + $scope.current_community.end_time ;
            $scope.shop_open = true;
          }
        }

        // set open_day as zero
        else {
          close_day_index = (close_day_index - open_day_index + 7) % 7;
          current_day_index = (current_day_index - open_day_index + 7) % 7;
          if (current_day_index < close_day_index) {
            // Phew.. we have time to order
            $scope.shop_open = true;
          } else {
            var x = new Date();
            x.setDate(x.getDate() + ((7 + open_day_index - x.getDay()) % 7));
            $scope.error_message = "Your window to place order is not open.</br>You can come back at <b>" + $scope.current_community.start_time + "</b> on <b>" + x.toString().split(' ').slice(0,3).join(' ') + "</b> to place the order.";
            // Sorry. You need to wait for couple of days
          }
        }

        return $scope.shop_open;
      }

      $scope.remove_float = function(item) {
        if ((item.unit.toLowerCase() == 'piece') || (item.unit.toLowerCase() == 'bunch')) {
          item.quantity = Math.floor(item.quantity);
        }
      }


      $scope.noGoogle = false;
      var uid = localStorage.getItem('uid');
      console.log('getting uid ' + uid);
      if ((uid) && (uid != 'undefined')) {
        $scope.noGoogle = true;
        $scope.onLogin({id: uid});
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

