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

      $scope.download_csv = function(d) {
        var formated_date = $scope.format_date(d);
        var data = $scope.orders[formated_date];
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
        link.download = formated_date + ".csv";
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

