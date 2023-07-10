# Clobber + Build

➜  chipmunk git:(rake2) time rake run_dev
platform:install -->   0.000115   0.000878   5.226109 ( 25.216403)
environment:check -->   0.001253   0.003210   0.100817 (  0.109530)
platform:build -->   0.000110   0.000817   2.800214 (  2.052837)
bindings:copy_platform -->   0.024677   0.159303   0.183980 (  1.743161)
bindings:install -->   0.000142   0.001142  15.188426 ( 40.399107)
bindings:build_rs_bindings -->   0.000411   0.009482 299.881109 ( 57.763232)
bindings:build_ts_bindings -->   0.000791   0.004130   3.373583 (  2.256861)
bindings:build -->   0.000014   0.000017   0.000031 (  0.000031)
electron:copy_tsbindings_and_platform -->   1.640815  14.022996  15.663811 ( 66.666204)
electron:install -->   0.000240   0.003755  43.011919 ( 88.139600)
client:install -->   0.000124   0.001277  32.600830 ( 91.624079)
matcher:install -->   0.000117   0.001169   6.006892 ( 13.506261)
matcher:build -->   0.000657   0.002195  19.954481 (  8.476216)
ansi:install -->   0.000104   0.001087   5.898064 ( 14.154683)
ansi:build -->   0.000390   0.001882  38.506075 (  9.280191)
utils:install -->   0.000109   0.001128   6.149039 ( 14.491074)
utils:build -->   0.000405   0.002037  34.002975 (  9.009222)
client:build_dev -->   0.003083   0.025821  62.672229 ( 54.622763)
electron:copy_client_debug -->   0.001988   0.023736   0.025724 (  0.040875)
updater:build -->   0.000194   0.001710  73.950498 ( 15.906165)
electron:do_build -->   0.000865   0.006287   5.051707 (  4.491143)
electron:build_dev -->   0.000063   0.000033   0.000096 (  0.000119)
[2023-07-16T10:54:13.986Z][DEBUG  ][ app ]: On close events stack:
- ClosingWithMenu
[2023-07-16T10:54:13.986Z][DEBUG  ][ app ]: Application will be closed with REGULAR case.
✨  Done in 14.22s.
cd -
run_dev -->   0.000101   0.001269   8.123875 ( 14.803803)
rake run_dev  541.84s user 136.64s system 126% cpu 8:40.87 total

# clean + build

platform:install -->   0.000115   0.000916   0.220439 (  0.216618)
environment:check -->   0.001281   0.003099   0.103841 (  0.184593)
platform:build -->   0.000120   0.000889   2.925978 (  2.376089)
bindings:copy_platform -->   0.079909   0.674489   0.754398 (  1.530808)
bindings:install -->   0.000128   0.001629   0.347821 (  0.215729)
bindings:build_rs_bindings -->   0.000366   0.006391 291.020236 ( 49.206934)
bindings:build_ts_bindings -->   0.000779   0.004191   3.291229 (  2.309365)
bindings:build -->   0.000014   0.000013   0.000027 (  0.000027)
electron:copy_tsbindings_and_platform -->   1.095132   9.714298  10.809430 ( 38.002880)
electron:install -->   0.000207   0.002563   1.606739 (  4.083538)
client:install -->   0.000110   0.001014   0.521979 (  0.307294)
matcher:install -->   0.000108   0.000935   0.359388 (  0.225401)
matcher:build -->   0.000361   0.001748  18.984907 (  7.723089)
ansi:install -->   0.000095   0.000835   0.369448 (  0.234557)
ansi:build -->   0.000424   0.001867  38.282280 (  9.275230)
utils:install -->   0.000094   0.000893   0.367374 (  0.248383)
utils:build -->   0.000418   0.001865  32.790024 (  8.057873)
client:build_dev -->   0.002986   0.022383  25.553641 ( 27.884154)
electron:copy_client_debug -->   0.001527   0.020387   0.021914 (  0.035207)
updater:build -->   0.000160   0.001463  69.996343 ( 11.642987)
electron:do_build -->   0.000976   0.006168   4.590163 (  3.911150)
electron:build_dev -->   0.000059   0.000027   0.000086 (  0.000086)
[2023-07-16T11:04:11.852Z][DEBUG  ][ app ]: Application will be closed with REGULAR case.
✨  Done in 33.11s.
cd -
run_dev -->   0.000087   0.001104  13.650802 (333.282709)
rake run_dev  467.52s user 49.19s system 103% cpu 2:51.19 total

# build again

platform:install -->   0.000252   0.002335   0.242489 (  0.230406)
environment:check -->   0.001189   0.002906   0.101878 (  0.167542)
platform:build -->   0.000170   0.001413   3.353629 (  4.526456)
bindings:copy_platform -->   0.025781   0.178307   0.204088 (  0.351560)
bindings:install -->   0.000133   0.001384   0.352696 (  0.220717)
bindings:build_rs_bindings -->   0.000316   0.006140   0.572571 (  1.531530)
bindings:build_ts_bindings -->   0.000373   0.001653   0.002026 (  0.010760)
bindings:build -->   0.000011   0.000007   0.000018 (  0.000018)
electron:copy_tsbindings_and_platform -->   1.073376   9.239767  10.313143 ( 37.006132)
electron:install -->   0.000222   0.002624   1.674580 (  3.952649)
client:install -->   0.000112   0.001187   0.571174 (  0.658443)
matcher:install -->   0.000111   0.001050   0.362326 (  0.247056)
matcher:build -->   0.000240   0.000712   0.000952 (  0.008467)
ansi:install -->   0.000099   0.001089   0.357378 (  0.243218)
ansi:build -->   0.000244   0.000718   0.000962 (  0.013227)
utils:install -->   0.000100   0.000988   0.377068 (  0.230513)
utils:build -->   0.000217   0.000636   0.000853 (  0.007550)
client:build_dev -->   0.002789   0.021073   0.023862 (  0.060404)
electron:copy_client_debug -->   0.004487   0.053177   0.057664 (  1.207130)
updater:build -->   0.000252   0.002090   0.260711 (  1.101829)
electron:do_build -->   0.001642   0.013003   0.014645 (  0.023079)
electron:build_dev -->   0.000105   0.000057   0.000162 (  0.000160)
run_dev -->   0.000146   0.002071   8.891770 ( 14.998834)
rake run_dev  15.85s user 12.23s system 41% cpu 1:08.29 total

