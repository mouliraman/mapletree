angular.module('myApp', ['ngSanitize', 'smart-table'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.nav = 'order-page';
      $scope.new_user = true;
      $scope.app_loaded = true;
      $scope.orders = [];

      $scope.today_date = new Date();
      $scope.display_dates = [];
      for(var i=-3;i<4;i++) {
        var d = new Date();
        d.setDate(d.getDate() + i);
        $scope.display_dates.push(d);
      }

      $scope.format_date = function (d) {
        return [d.getFullYear(), d.getMonth()+1, d.getDate()].join('-');
      }

      $scope.onGetAllUsers = function(response) {
        $scope.users = response.users;
      }

      $scope.onGetOrders = function(response) {
        $scope.orders[response.order_id] = response.orders;
      }

      $scope.onProfle = function(response) {
        $scope.error_message = null;
        if ((response.status == 'success') && (response.profile.admin)) {
          $scope.current_user = response.profile;
          $http.get('/data/users/all.json').success($scope.onGetAllUsers);
          for (var i=0;i<$scope.display_dates.length;i++) {
            $http.get('/data/orders/' + $scope.format_date($scope.display_dates[i]) + '/all.json').success($scope.onGetOrders);
          }
        } else {
          $scope.error_message = "Only admin users have access to this page";
          $scope.signOut();
        }
      }

      $scope.onGoogleLogin = function(response) {
        var profile = response.getBasicProfile();
        $http.get('/data/users/' + profile.getId() + '.json').success($scope.onProfle);
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

