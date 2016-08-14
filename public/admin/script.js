angular.module('myApp', ['smart-table'])
.controller('mainCtrl', ['$scope', '$http', '$filter',
    function ($scope, $http, $filter) {

      $scope.nav = 'order-page';
      $scope.new_user = true;
      $scope.app_loaded = true;

      $scope.options = {
        'onsuccess': function(response) {
          console.log('onsuccess called');
          var profile = response.getBasicProfile();
          $scope.$apply(function() {
            $scope.current_user = {id: profile.getId(), name: profile.getName(), profile_url: profile.getImageUrl(), email: profile.getEmail()};
          });
          $http.get('data/' + profile.getId() + '/profile.json').then(function(response) {
            $scope.current_user = response.data;

            $http.get('communities.json').success(function(data) {

              $scope.communities = data;

              if (typeof($scope.current_user.mobile) != 'undefined') {

                for (var i=0;i<$scope.communities.length;i++) {
                  var c = $scope.communities[i];
                  if (c.name == $scope.current_user.community) {
                    $scope.current_community = c;
                    break;
                  }
                }

                if ($scope.current_community) {

                  $scope.new_user = false;

                  $http.get('data.json').success(function(data) {

                    $scope.loaded = 1;
                    $scope.skus = data;

                    for (var i=0;i<$scope.skus.length;i++) {
                      $scope.skus[i].quantity = 0;
                      $scope.skus[i].price = 0;
                    }

                  });
                }
              }
              if ($scope.new_user) {
                $scope.navigateTo('preferences');
              }
            });

          }, function(res) {
            if (res.status == 404) {
              $http.post('/data/' + profile.getId() + '/profile.json', $scope.current_user);
            }
          });
        },
        'onfailure': function(response) {
          console.log('failed to login');
        }
      }

      $scope.loaded = 0;

      $scope.$on('event:google-plus-signin-success', function (event, authResult) {
        // User successfully authorized the G+ App!
        console.log('Signed in!');
      });
      $scope.$on('event:google-plus-signin-failure', function (event, authResult) {
        // User has not authorized the G+ App!
        console.log('Not signed into Google Plus.');
      });

      $scope.registerUser = function() {
        $http.post('/data/' + $scope.current_user.id + '/profile.json', $scope.current_user).success(function() {
          $scope.new_user = false;
        });
      }

      $scope.navigateTo = function(dest) {
        $scope.nav = dest;
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
        $http.post('/data/' + $scope.current_user.id + '/order.json', $scope.current_order());
      }

      $scope.signOut = function() {
        var auth2 = gapi.auth2.getAuthInstance();
        auth2.signOut().then(function () {
          console.log('User signed out.');
          $scope.$apply(function () {
            $scope.current_user = null;
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

